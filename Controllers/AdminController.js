import bcrypt from "bcryptjs";
import db from "../config/db.js";
import jwt from "jsonwebtoken"; // Import JWT
import nodemailer from "nodemailer";
import {
  sendBlockEmail,
  sendComplaintStatusEmail,
  sendStudentBlockEmail,
  sendStudentUnblockEmail,
  sendUnblockEmail,
} from "../services/emailService.js";

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "admin@ideagroove";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res
        .status(200)
        .cookie("admin_token", "authorized_access_granted", {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 1 day
        })
        .json({
          success: true,
          message: "Login Successful!",
          role: "admin",
        });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Access denied.",
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const adminLogout = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });

    req.session = null;
    res.clearCookie("session"); // Clear browser cookie
    res.clearCookie("session.sig"); // Clear signature

    return res.status(200).json({ message: "Logged out successfully" });
  });
};

export const getDashboardStats = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT COUNT(*) AS total FROM student_tbl WHERE Is_Active = 1",
    );

    const [notes] = await db.query("SELECT COUNT(*) AS total FROM notes_tbl");

    const [questions] = await db.query(
      "SELECT COUNT(*) AS total FROM question_tbl",
    );

    const [groups] = await db.query(
      "SELECT COUNT(*) AS total FROM chat_rooms_tbl WHERE Is_Active = 1",
    );

    const [events] = await db.query(
      `SELECT COUNT(*) AS total 
FROM event_tbl 
WHERE Event_Date >= CURDATE()
AND Is_Active = 1`,
    );

    const [complaints] = await db.query(
      "SELECT COUNT(*) AS total FROM complaint_tbl WHERE status != 'resolved'",
    );

    res.json({
      totalUsers: users[0].total,
      totalNotes: notes[0].total,
      totalQuestions: questions[0].total,
      activeGroups: groups[0].total,
      upcomingEvents: events[0].total,
      complaints: complaints[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

// export const updateComplaintStatus = async (req, res) => {
//   const { id, status } = req.body;

//   try {
//     const [result] = await db.query(
//       `
//       UPDATE complaint_tbl
//       SET status = ?
//       WHERE Complaint_ID = ?
//       `,
//       [status, id],
//     );

//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         error: "Complaint not found",
//       });
//     }

//     res.json({
//       message: "Complaint status updated successfully",
//     });
//   } catch (err) {
//     console.error("Complaint Status Updation Error:", err);
//     res.status(500).json({
//       error: "Internal Server Error",
//     });
//   }
// };

export const getTopContributor = async (req, res) => {
  try {
    const [topContributors] = await db.query(`
  SELECT 
    s.S_ID,
    s.Name,
    s.Profile_Pic,
    d.Degree_Name,
    SUM(t.total) + 0 AS grand_total
  FROM (
    SELECT Added_By AS student_id, COUNT(*) AS total
    FROM event_tbl
    WHERE Is_Active = 1
    GROUP BY Added_By

    UNION ALL

    SELECT Created_By AS student_id, COUNT(*) AS total
    FROM chat_rooms_tbl
    WHERE Is_Active = 1
    GROUP BY Created_By

    UNION ALL

    SELECT Added_By AS student_id, COUNT(*) AS total
    FROM notes_tbl
    WHERE Is_Active = 1
    GROUP BY Added_By

    UNION ALL

    SELECT Added_By AS student_id, COUNT(*) AS total
    FROM question_tbl
    WHERE Is_Active = 1
    GROUP BY Added_By
  ) t
  JOIN student_tbl s ON s.S_ID = t.student_id
  LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID
  GROUP BY s.S_ID, s.Name, d.Degree_Name
  ORDER BY grand_total DESC
  LIMIT 3
`);

    res.json(topContributors);
  } catch (err) {
    console.err("Fetching Contributor Error : ", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    const [recentActivity] = await db.query(`
  SELECT *
  FROM (
    -- EVENTS
    SELECT 
      e.E_ID AS activity_id,
      e.Added_By AS student_id,
      s.Name AS student_name,
      s.Profile_Pic AS profile_pic,
      'EVENT' AS activity_type,
      e.Description AS title_or_action,
      e.Added_On AS created_at,
      e.Is_Active AS status
    FROM event_tbl e
    JOIN student_tbl s ON s.S_ID = e.Added_By

    UNION ALL

    -- GROUPS
    SELECT 
      g.Room_ID AS activity_id,
      g.Created_By AS student_id,
      s.Name AS student_name,
      s.Profile_Pic AS profile_pic,
      'GROUP' AS activity_type,
      g.Room_Name AS title_or_action,
      g.Created_On AS created_at,
      g.Is_Active AS status
    FROM chat_rooms_tbl g
    JOIN student_tbl s ON s.S_ID = g.Created_By

    UNION ALL

    -- NOTES
    SELECT 
      n.N_ID AS activity_id,
      n.Added_By AS student_id,
      s.Name AS student_name,
      s.Profile_Pic AS profile_pic,
      'NOTE' AS activity_type,
      n.File_Name AS title_or_action,
      n.Added_On AS created_at,
      n.Is_Active AS status
    FROM notes_tbl n
    JOIN student_tbl s ON s.S_ID = n.Added_By

    UNION ALL

    -- QUESTIONS
    SELECT 
      q.Q_ID AS activity_id,
      q.Added_By AS student_id,
      s.Name AS student_name,
      s.Profile_Pic AS profile_pic,
      'QUESTION' AS activity_type,
      q.Question AS title_or_action,
      q.Added_On AS created_at,
      q.Is_Active AS status
    FROM question_tbl q
    JOIN student_tbl s ON s.S_ID = q.Added_By

    UNION ALL

    -- COMPLAINTS
    SELECT 
      c.Complaint_ID AS activity_id,
      c.Student_ID AS student_id,
      s.Name AS student_name,
      s.Profile_Pic AS profile_pic,
      'COMPLAINT' AS activity_type,
      c.Complaint_Text AS title_or_action,
      c.Date AS created_at,
      c.Is_Active AS status
    FROM complaint_tbl c
    JOIN student_tbl s ON s.S_ID = c.Student_ID

  ) AS combined_activity
  ORDER BY created_at DESC
`);
    res.json(recentActivity);
  } catch (err) {
    console.error("Unable to fetch the recent activity: ", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

export const getNotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const filter = req.query.filter || "all";
    const degreeId = req.query.degree ? parseInt(req.query.degree) : null;
    const subjectId = req.query.subject ? parseInt(req.query.subject) : null;

    let conditions = [];
    const queryParams = [];

    if (search) {
      conditions.push("(n.Description LIKE ? OR sub.Subject_Name LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (degreeId) {
      conditions.push("n.Degree_ID = ?");
      queryParams.push(degreeId);
    }

    if (subjectId) {
      conditions.push("n.Subject_ID = ?");
      queryParams.push(subjectId);
    }

    const whereClause =
      conditions.length > 0 ? conditions.join(" AND ") : "1=1";
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM notes_tbl n
       LEFT JOIN subject_tbl sub ON n.Subject_ID = sub.Subject_ID
       WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    const allNotesQuery = `
      SELECT 
        n.N_ID,
        n.Note_File,
        n.File_Name,
        n.Description,
        n.Is_Active,
        n.Added_on,
        n.Added_By,
        s.Username AS Author,
        s.S_ID AS Author_ID,
        d.Degree_Name,
        d.Degree_ID,
        sub.Subject_Name,
        sub.Subject_ID
      FROM notes_tbl n
      LEFT JOIN student_tbl s   ON n.Added_By = s.S_ID
      LEFT JOIN degree_tbl d    ON n.Degree_ID = d.Degree_ID
      LEFT JOIN subject_tbl sub ON n.Subject_ID = sub.Subject_ID
      WHERE ${whereClause}
      LIMIT ? OFFSET ?
    `;

    const [notes] = await db.query(allNotesQuery, [
      ...queryParams,
      limit,
      offset,
    ]);

    res.status(200).json({
      status: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      notes,
    });
  } catch (err) {
    console.error("Fetch Notes Error: ", err);
    res.status(500).json({ status: false, error: "Failed to fetch notes" });
  }
};

const CONTENT_CONFIG = {
  note: {
    table: "notes_tbl",
    idColumn: "N_ID",
    titleCol: "File_Name",
    ownerCol: "Added_By",
    alias: "n",
    label: "Note",
  },
  event: {
    table: "event_tbl",
    idColumn: "E_ID",
    titleCol: "Description",
    ownerCol: "Added_By",
    alias: "e",
    label: "Event",
  },
  group: {
    table: "chat_rooms_tbl",
    idColumn: "Room_ID",
    titleCol: "Room_Name",
    ownerCol: "Created_By",
    alias: "cr",
    label: "Group",
  },
  question: {
    table: "question_tbl",
    idColumn: "Q_ID",
    titleCol: "Question",
    ownerCol: "Added_By",
    alias: "q",
    label: "Question",
  },
  answer: {
    table: "answer_tbl",
    idColumn: "A_ID",
    titleCol: "Answer",
    ownerCol: "Answered_By",
    alias: "a",
    label: "Answer",
  },
};

const getContentWithOwner = async (type, id) => {
  const config = CONTENT_CONFIG[type];
  if (!config) throw new Error(`Unknown content type: ${type}`);

  const { table, idColumn, titleCol, alias, ownerCol } = config;

  let query;
  let params = [id];

  // ─── Special case for answer — include question details ───────────────────
  if (type === "answer") {
    query = `
      SELECT
        a.A_ID AS content_id,
        a.Answer AS content_title,
        a.Is_Active,
        s.S_ID AS owner_id,
        s.name AS owner_name,
        s.email AS owner_email,
        q.Q_ID AS question_id,
        q.Question AS question_text,
        qs.S_ID AS question_owner_id,
        qs.name AS question_owner_name,
        qs.email AS question_owner_email
      FROM answer_tbl a
      JOIN student_tbl s  ON s.S_ID = a.Answered_By
      JOIN question_tbl q ON q.Q_ID = a.Q_ID
      JOIN student_tbl qs ON qs.S_ID = q.Added_By
      WHERE a.A_ID = ?
    `;
  } else {
    // ─── Generic case for all other types ────────────────────────────────────
    query = `
      SELECT
        ${alias}.${idColumn} AS content_id,
        ${alias}.${titleCol} AS content_title,
        ${alias}.Is_Active,
        s.S_ID AS owner_id,
        s.name AS owner_name,
        s.email AS owner_email
      FROM ${table} ${alias}
      JOIN student_tbl s ON s.S_ID = ${alias}.${ownerCol}
      WHERE ${alias}.${idColumn} = ?
    `;
  }

  const result = await db.query(query, params);
  const rows = result[0];
  return rows[0] || null;
};

export const blockContent = async (req, res) => {
  const { type, id, reason } = req.body;

  if (!type || !id) {
    return res
      .status(400)
      .json({ status: false, message: "type and id are required" });
  }

  const config = CONTENT_CONFIG[type];
  if (!config) {
    return res
      .status(400)
      .json({ status: false, message: `Invalid type: ${type}` });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get content + owner details
    const content = await getContentWithOwner(type, id);
    if (!content) {
      await connection.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Content not found" });
    }

    if (content.Is_Active === 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: false, message: "Content is already blocked" });
    }

    // Block it
    const deletedOnCol = type === "group" ? ", Deleted_On = NOW()" : "";
    await connection.query(
      `UPDATE ${config.table} SET Is_Active = 0 ${deletedOnCol} WHERE ${config.idColumn} = ?`,
      [id],
    );

    await connection.commit();

    // Send email (non-blocking — don't fail if email fails)
    try {
      if (type === "answer") {
        // Notify answer owner
        await sendBlockEmail({
          toEmail: content.owner_email,
          studentName: content.owner_name,
          contentType: "Answer",
          contentTitle: content.content_title,
          reason: reason || null,
          // Extra context
          extraInfo: `This was an answer to the question: "${content.question_text}" posted by ${content.question_owner_name}`,
        });
      } else {
        await sendBlockEmail({
          toEmail: content.owner_email,
          studentName: content.owner_name,
          contentType: config.label,
          contentTitle: content.content_title,
          reason: reason || null,
        });
      }
    } catch (emailErr) {
      console.error("Block email failed:", emailErr.message);
    }

    res.status(200).json({
      status: true,
      message: `${config.label} blocked successfully and email sent to ${content.owner_email}`,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Block Content Error:", err);
    res.status(500).json({ status: false, error: "Failed to block content" });
  } finally {
    if (connection) connection.release();
  }
};

// ─── UNBLOCK ──────────────────────────────────────────────────────────────────
// POST /api/admin/unblock
// Body: { type: "note"|"event"|"group"|"question", id }
export const unblockContent = async (req, res) => {
  const { type, id } = req.body;

  if (!type || !id) {
    return res
      .status(400)
      .json({ status: false, message: "type and id are required" });
  }

  const config = CONTENT_CONFIG[type];
  if (!config) {
    return res
      .status(400)
      .json({ status: false, message: `Invalid type: ${type}` });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get content + owner details
    const content = await getContentWithOwner(type, id);
    if (!content) {
      await connection.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Content not found" });
    }

    if (content.Is_Active === 1) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: false, message: "Content is already active" });
    }

    // Unblock it
    const deletedOnCol = type === "group" ? ", Deleted_On = NULL" : "";
    await connection.query(
      `UPDATE ${config.table} SET Is_Active = 1 ${deletedOnCol} WHERE ${config.idColumn} = ?`,
      [id],
    );

    await connection.commit();

    // Send email (non-blocking)
    try {
      if (type === "answer") {
        await sendUnblockEmail({
          toEmail: content.owner_email,
          studentName: content.owner_name,
          contentType: "Answer",
          contentTitle: content.content_title,
          extraInfo: `This was an answer to the question: "${content.question_text}" posted by ${content.question_owner_name}`,
        });
      } else {
        await sendUnblockEmail({
          toEmail: content.owner_email,
          studentName: content.owner_name,
          contentType: config.label,
          contentTitle: content.content_title,
        });
      }
    } catch (emailErr) {
      console.error("Unblock email failed:", emailErr.message);
    }

    res.status(200).json({
      status: true,
      message: `${config.label} unblocked successfully and email sent to ${content.owner_email}`,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Unblock Content Error:", err);
    res.status(500).json({ status: false, error: "Failed to unblock content" });
  } finally {
    if (connection) connection.release();
  }
};

export const toggleBlock = async (req, res) => {
  const { type, id, reason } = req.body;

  const config = CONTENT_CONFIG[type];
  if (!config) {
    return res
      .status(400)
      .json({ status: false, message: `Invalid type: ${type}` });
  }

  try {
    const content = await getContentWithOwner(type, id);
    if (!content) {
      return res
        .status(404)
        .json({ status: false, message: "Content not found" });
    }

    // Delegate to block or unblock based on current status
    req.body = { ...req.body, id };
    if (content.Is_Active === 1) {
      return blockContent(req, res);
    } else {
      return unblockContent(req, res);
    }
  } catch (err) {
    console.error("Toggle Block Error:", err);
    res.status(500).json({ status: false, error: "Failed to toggle block" });
  }
};

export const updateComplaintStatus = async (req, res) => {
  const { id, status, reason } = req.body;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Get complaint + student details
    const result = await connection.query(
      `SELECT 
         c.Complaint_ID,
         c.Complaint_Text,
         c.Status,
         s.name AS student_name,
         s.email AS student_email
       FROM complaint_tbl c
       JOIN student_tbl s ON s.S_ID = c.Student_ID
       WHERE c.Complaint_ID = ?`,
      [id],
    );

    const complaint = result[0][0];
    if (!complaint) {
      await connection.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Complaint not found" });
    }

    // 2. Update status
    await connection.query(
      `UPDATE complaint_tbl SET Status = ? WHERE Complaint_ID = ?`,
      [status, id],
    );

    await connection.commit();

    // 3. Send email (non-blocking)
    try {
      await sendComplaintStatusEmail({
        toEmail: complaint.student_email,
        studentName: complaint.student_name,
        complaintText: complaint.Complaint_Text,
        oldStatus: complaint.Status,
        newStatus: status,
        reason: reason || null,
      });
    } catch (emailErr) {
      console.error("Complaint email failed:", emailErr.message);
    }

    res.status(200).json({ message: "Complaint status updated successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Complaint Status Update Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (connection) connection.release();
  }
};

export const blockStudent = async (req, res) => {
  const { id, reason } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "Student ID is required" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT S_ID, Name, Email, is_Active FROM student_tbl WHERE S_ID = ?`,
      [id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Student not found" });
    }

    const student = rows[0];

    if (student.is_Active === 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: false, message: "Student is already blocked" });
    }

    await connection.query(
      `UPDATE student_tbl SET is_Active = 0 WHERE S_ID = ?`,
      [id],
    );

    await connection.commit();

    try {
      await sendStudentBlockEmail({
        toEmail: student.Email,
        studentName: student.Name,
        reason: reason || null,
      });
    } catch (emailErr) {
      console.error("Student block email failed:", emailErr.message);
    }

    res.status(200).json({
      status: true,
      message: `Student blocked successfully. Email sent to ${student.Email}`,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Block Student Error:", err);
    res.status(500).json({ status: false, error: "Failed to block student" });
  } finally {
    if (connection) connection.release();
  }
};

export const unblockStudent = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ status: false, message: "Student ID is required" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT S_ID, Name, Email, is_Active FROM student_tbl WHERE S_ID = ?`,
      [id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ status: false, message: "Student not found" });
    }

    const student = rows[0];

    if (student.is_Active === 1) {
      await connection.rollback();
      return res
        .status(400)
        .json({ status: false, message: "Student is already active" });
    }

    await connection.query(
      `UPDATE student_tbl SET is_Active = 1 WHERE S_ID = ?`,
      [id],
    );

    await connection.commit();

    try {
      await sendStudentUnblockEmail({
        toEmail: student.Email,
        studentName: student.Name,
      });
    } catch (emailErr) {
      console.error("Student unblock email failed:", emailErr.message);
    }

    res.status(200).json({
      status: true,
      message: `Student unblocked successfully. Email sent to ${student.Email}`,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Unblock Student Error:", err);
    res.status(500).json({ status: false, error: "Failed to unblock student" });
  } finally {
    if (connection) connection.release();
  }
};

// const getMonthlyTrend = async (tableName, dateColumn) => {
//   const [rows] = await db.query(`
//     SELECT
//       DATE_FORMAT(${dateColumn}, '%b') AS label,
//       COUNT(*)                          AS value
//     FROM ${tableName}
//     WHERE ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
//     GROUP BY DATE_FORMAT(${dateColumn}, '%Y-%m'), DATE_FORMAT(${dateColumn}, '%b')
//     ORDER BY DATE_FORMAT(${dateColumn}, '%Y-%m') ASC
//   `);
//   return rows;
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 0. USERS REPORT  —  GET /admin/users-report
// // ─────────────────────────────────────────────────────────────────────────────
// export const getUsersReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.degree) {
//       where.push("s.Degree_ID = ?");
//       params.push(filters.degree);
//     }

//     if (filters.college) {
//       where.push("s.College_ID = ?");
//       params.push(filters.college);
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

//     const [rows] = await db.query(
//       `
//       SELECT
//         s.S_ID,
//         s.Name,
//         s.Roll_No,
//         s.Email,
//         s.Year,
//         s.is_Active,
//         d.Degree_Name,
//         h.Hobby_Name AS hobby_name
//       FROM student_tbl s
//       LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID
//       LEFT JOIN student_hobby_mapping_tbl shm ON s.S_ID = shm.Student_ID
//       LEFT JOIN hobbies_tbl h ON shm.Hobby_ID = h.Hobby_ID
//       ${whereClause}
//       ORDER BY s.Name ASC
//     `,
//       params,
//     );

//     const total = rows.length;
//     const active = rows.filter((r) => r.is_Active === 1).length;
//     const blocked = total - active;
//     const degrees = [...new Set(rows.map((r) => r.Degree_Name).filter(Boolean))]
//       .length;

//     const summary = [
//       { label: "Total Users", value: total },
//       { label: "Active", value: active },
//       { label: "Blocked", value: blocked },
//       { label: "Degrees", value: degrees },
//     ];

//     const donut = [
//       { label: "Active", value: active, color: "#0ea5e9" },
//       { label: "Blocked", value: blocked, color: "#94a3b8" },
//     ].filter((s) => s.value > 0);

//     // bar chart: students per degree
//     const degreeMap = rows.reduce((acc, r) => {
//       const d = r.Degree_Name || "Unknown";
//       acc[d] = (acc[d] || 0) + 1;
//       return acc;
//     }, {});
//     const bars = Object.entries(degreeMap)
//       .map(([label, value]) => ({ label, value }))
//       .sort((a, b) => b.value - a.value)
//       .slice(0, 6);

//     res.status(200).json({ summary, chartData: { donut, bars }, rows });
//   } catch (err) {
//     console.error("Users Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch users report" });
//   }
// };

// export const getEventsReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.event_status === "Upcoming") {
//       where.push("e.Event_Date >= CURDATE()");
//     }

//     if (filters.event_status === "Past") {
//       where.push("e.Event_Date < CURDATE()");
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
//     const [rows] = await db.query(`
//       SELECT
//         e.E_ID,
//         e.Description,
//         DATE_FORMAT(e.Event_Date, '%Y-%m-%d')  AS Event_Date,
//         DATE_FORMAT(e.Added_On,   '%Y-%m-%d')  AS Added_On,
//         e.Is_Active,
//         s.Name  AS student_name,
//         CASE WHEN e.Event_Date >= CURDATE() THEN 'Upcoming' ELSE 'Past' END AS event_status
//       FROM event_tbl e
//       LEFT JOIN student_tbl s ON s.S_ID = e.Added_By
//       ${whereClause}
//       ORDER BY e.Event_Date DESC
//     `);

//     const total = rows.length;
//     const active = rows.filter((r) => r.Is_Active === 1).length;
//     const blocked = total - active;
//     const upcoming = rows.filter((r) => r.event_status === "Upcoming").length;
//     const past = total - upcoming;

//     const summary = [
//       { label: "Total Events", value: total },
//       { label: "Upcoming", value: upcoming },
//       { label: "Past", value: past },
//       { label: "Blocked", value: blocked },
//     ];

//     const donut = [
//       { label: "Upcoming", value: upcoming, color: "#f59e0b" },
//       { label: "Past", value: past, color: "#94a3b8" },
//     ].filter((s) => s.value > 0);

//     const bars = await getMonthlyTrend("event_tbl", "Event_Date");

//     res.status(200).json({
//       summary,
//       chartData: { donut, bars },
//       rows,
//     });
//   } catch (err) {
//     console.error("Events Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch events report" });
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 2. GROUPS REPORT  —  GET /admin/groups-report
// // ─────────────────────────────────────────────────────────────────────────────
// export const getGroupsReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.hobby) {
//       where.push("h.Hobby_ID = ?");
//       params.push(filters.hobby);
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
//     // Fetch column names so we can adapt dynamically
//     const [[colInfo]] = await db.query(
//       `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
//        WHERE TABLE_NAME = 'chat_rooms_tbl'
//        AND COLUMN_NAME IN ('Created_On','Created_At')
//        LIMIT 1`,
//     );
//     const dateCol = colInfo?.COLUMN_NAME || null;
//     const dateExpr = dateCol
//       ? `DATE_FORMAT(cr.${dateCol}, '%Y-%m-%d')`
//       : `NULL`;

//     const [rows] = await db.query(
//       `
//       SELECT
//         cr.Room_ID,
//         cr.Room_Name,
//         ${dateExpr} AS Created_On,
//         cr.Is_Active,
//         s.Name         AS student_name,
//         h.Hobby_Name   AS hobby_name,
//         (
//           SELECT COUNT(*)
//           FROM chat_room_members_tbl cm2
//           WHERE cm2.Room_ID = cr.Room_ID
//         ) AS member_count
//       FROM chat_rooms_tbl cr
//       LEFT JOIN student_tbl s ON s.S_ID = cr.Created_By
//       LEFT JOIN student_hobby_mapping_tbl shm ON s.S_ID = shm.Student_ID
//       LEFT JOIN hobbies_tbl h ON shm.Hobby_ID = h.Hobby_ID
//       ${whereClause}
//       ORDER BY cr.Room_ID DESC
//     `,
//       params,
//     );

//     const total = rows.length;
//     const active = rows.filter((r) => r.Is_Active === 1).length;
//     const blocked = total - active;
//     const totalMembers = rows.reduce(
//       (sum, r) => sum + (r.member_count || 0),
//       0,
//     );
//     const avgMembers = total > 0 ? Math.round(totalMembers / total) : 0;

//     const summary = [
//       { label: "Total Groups", value: total },
//       { label: "Active", value: active },
//       { label: "Blocked", value: blocked },
//       { label: "Avg Members", value: avgMembers },
//     ];

//     const donut = [
//       { label: "Active", value: active, color: "#9333ea" },
//       { label: "Blocked", value: blocked, color: "#94a3b8" },
//     ].filter((s) => s.value > 0);

//     let bars = [];
//     if (dateCol) {
//       try {
//         bars = await getMonthlyTrend("chat_rooms_tbl", dateCol);
//       } catch {}
//     }

//     res.status(200).json({
//       summary,
//       chartData: { donut, bars },
//       rows,
//     });
//   } catch (err) {
//     console.error("Groups Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch groups report" });
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 3. NOTES REPORT  —  GET /admin/notes-report
// // ─────────────────────────────────────────────────────────────────────────────
// export const getNotesReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.degree) {
//       where.push("d.Degree_ID = ?");
//       params.push(filters.degree);
//     }

//     if (filters.subject) {
//       where.push("sub.Subject_ID = ?");
//       params.push(filters.subject);
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
//     const [rows] = await db.query(
//       `
//       SELECT
//         n.N_ID,
//         n.File_Name,
//         n.Description,
//         DATE_FORMAT(n.Added_On, '%Y-%m-%d') AS Added_On,
//         n.Is_Active,
//         s.Name          AS student_name,
//         sub.Subject_Name,
//         d.Degree_Name
//       FROM notes_tbl n
//       LEFT JOIN student_tbl s ON s.S_ID = n.Added_By
//       LEFT JOIN subject_tbl sub ON sub.Subject_ID = n.Subject_ID
//       LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID
//       ${whereClause}
//       ORDER BY n.Added_On DESC
//     `,
//       params,
//     );

//     const total = rows.length;
//     const active = rows.filter((r) => r.Is_Active === 1).length;
//     const blocked = total - active;

//     // unique uploaders
//     const uniqueAuthors = new Set(
//       rows.map((r) => r.student_name).filter(Boolean),
//     ).size;

//     const summary = [
//       { label: "Total Notes", value: total },
//       { label: "Active", value: active },
//       { label: "Blocked", value: blocked },
//       { label: "Contributors", value: uniqueAuthors },
//     ];

//     const donut = [
//       { label: "Active", value: active, color: "#e11d48" },
//       { label: "Blocked", value: blocked, color: "#94a3b8" },
//     ].filter((s) => s.value > 0);

//     const bars = await getMonthlyTrend("notes_tbl", "Added_On");

//     res.status(200).json({
//       summary,
//       chartData: { donut, bars },
//       rows,
//     });
//   } catch (err) {
//     console.error("Notes Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch notes report" });
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 4. Q&A REPORT  —  GET /admin/qna-report
// // ─────────────────────────────────────────────────────────────────────────────
// export const getQnAReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.degree) {
//       where.push("s.Degree_ID = ?");
//       params.push(filters.degree);
//     }

//     if (filters.subject) {
//       where.push("sub.Subject_ID = ?");
//       params.push(filters.subject);
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
//     const [rows] = await db.query(`
//       SELECT
//         q.Q_ID,
//         q.Question,
//         DATE_FORMAT(q.Added_On, '%Y-%m-%d') AS Added_On,
//         q.Is_Active,
//         s.Name           AS student_name,
//         sub.Subject_Name,
//         COUNT(a.A_ID)    AS answer_count,
//         (
//           SELECT a2.Answer
//           FROM answer_tbl a2
//           WHERE a2.Q_ID = q.Q_ID
//           ORDER BY a2.A_ID ASC
//           LIMIT 1
//         )                AS top_answer
//       FROM question_tbl q
//       LEFT JOIN student_tbl s ON s.S_ID = q.Added_By
//       LEFT JOIN subject_tbl sub ON sub.Subject_ID = q.Subject_ID
//       LEFT JOIN answer_tbl a ON a.Q_ID = q.Q_ID
//       ${whereClause}
//       GROUP BY q.Q_ID, q.Question, q.Added_On, q.Is_Active,
//                s.Name, sub.Subject_Name
//       ORDER BY q.Added_On DESC
//     `);

//     const total = rows.length;
//     const active = rows.filter((r) => r.Is_Active === 1).length;
//     const blocked = total - active;
//     const answered = rows.filter((r) => r.answer_count > 0).length;
//     const unanswered = total - answered;

//     const summary = [
//       { label: "Total Questions", value: total },
//       { label: "Active", value: active },
//       { label: "Answered", value: answered },
//       { label: "Unanswered", value: unanswered },
//     ];

//     const donut = [
//       { label: "Answered", value: answered, color: "#25eb63" },
//       { label: "Unanswered", value: unanswered, color: "#f59e0b" },
//       { label: "Blocked", value: blocked, color: "#94a3b8" },
//     ].filter((s) => s.value > 0);

//     const bars = await getMonthlyTrend("question_tbl", "Added_On");

//     res.status(200).json({
//       summary,
//       chartData: { donut, bars },
//       rows,
//     });
//   } catch (err) {
//     console.error("Q&A Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch Q&A report" });
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // 5. COMPLAINTS REPORT  —  GET /admin/complaints-report
// // ─────────────────────────────────────────────────────────────────────────────
// export const getComplaintsReport = async (req, res) => {
//   try {
//     const filters = req.body || {};
//     let where = [];
//     let params = [];

//     if (filters.type) {
//       where.push("c.Type = ?");
//       params.push(filters.type);
//     }

//     const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
//     // Discover FK column name in complaint_tbl dynamically
//     const [[fkCol]] = await db.query(
//       `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
//        WHERE TABLE_NAME = 'complaint_tbl'
//        AND COLUMN_NAME IN ('S_ID','Student_ID','student_id')
//        LIMIT 1`,
//     );
//     const complaintFk = fkCol?.COLUMN_NAME || "S_ID";

//     const complaintSQL =
//       `
//       SELECT
//         c.Complaint_ID,
//         c.Complaint_Text,
//         c.Type AS Complaint_Type,
//         DATE_FORMAT(c.Date, '%Y-%m-%d') AS Date,
//         c.Status,
//         s.Name  AS student_name,
//         DATEDIFF(NOW(), c.Date) AS age_days
//       FROM complaint_tbl c
//       LEFT JOIN student_tbl s ON s.S_ID = c.` +
//       "`" +
//       `${complaintFk}` +
//       "`" +
//       `
//       ${whereClause}
//       ORDER BY c.Date DESC
//     `;
//     const [rows] = await db.query(complaintSQL, params);

//     const total = rows.length;
//     const resolved = rows.filter((r) => r.Status === "Resolved").length;
//     const pending = rows.filter((r) => r.Status === "Pending").length;
//     const inProgress = rows.filter((r) => r.Status === "In-Progress").length;
//     const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

//     const summary = [
//       { label: "Total", value: total },
//       { label: "Resolved", value: resolved },
//       { label: "Pending", value: pending },
//       { label: "In-Progress", value: inProgress },
//       { label: "Resolution %", value: resRate + "%" },
//     ];

//     const donut = [
//       { label: "Resolved", value: resolved, color: "#25eb63" },
//       { label: "Pending", value: pending, color: "#f59e0b" },
//       { label: "In-Progress", value: inProgress, color: "#ef4444" },
//     ].filter((s) => s.value > 0);

//     const bars = await getMonthlyTrend("complaint_tbl", "Date");

//     res.status(200).json({
//       summary,
//       chartData: { donut, bars },
//       rows,
//     });
//   } catch (err) {
//     console.error("Complaints Report Error:", err);
//     res.status(500).json({ error: "Failed to fetch complaints report" });
//   }
// };

const getMonthlyTrend = async (tableName, dateColumn) => {
  const [rows] = await db.query(`
    SELECT
      DATE_FORMAT(${dateColumn}, '%b') AS label,
      COUNT(*)                          AS value
    FROM ${tableName}
    WHERE ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(${dateColumn}, '%Y-%m'), DATE_FORMAT(${dateColumn}, '%b')
    ORDER BY DATE_FORMAT(${dateColumn}, '%Y-%m') ASC
  `);
  return rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// 0. USERS REPORT  —  POST /admin/users-report
// ─────────────────────────────────────────────────────────────────────────────
export const getUsersReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];
    const params = [];

    if (filters.degree) {
      where.push("d.Degree_Name = ?");
      params.push(filters.degree);
    }
    if (filters.college) {
      where.push("col.College_Name = ?");
      params.push(filters.college);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows] = await db.query(
      `SELECT
        s.S_ID,
        s.Name,
        s.Roll_No,
        s.Email,
        s.Year,
        s.is_Active,
        d.Degree_Name,
        col.College_Name,
        h.Hobby_Name AS hobby_name
      FROM student_tbl s
      LEFT JOIN degree_tbl d   ON d.Degree_ID   = s.Degree_ID
      LEFT JOIN college_tbl col ON col.College_ID = s.College_ID
      LEFT JOIN student_hobby_mapping_tbl shm ON s.S_ID = shm.Student_ID
      LEFT JOIN hobbies_tbl h  ON shm.Hobby_ID  = h.Hobby_ID
      ${whereClause}
      ORDER BY s.Name ASC`,
      params,
    );

    const total = rows.length;
    const active = rows.filter((r) => r.is_Active === 1).length;
    const blocked = total - active;
    const degrees = [...new Set(rows.map((r) => r.Degree_Name).filter(Boolean))]
      .length;

    const summary = [
      { label: "Total Users", value: total },
      { label: "Active", value: active },
      { label: "Blocked", value: blocked },
      { label: "Degrees", value: degrees },
    ];

    const donut = [
      { label: "Active", value: active, color: "#0ea5e9" },
      { label: "Blocked", value: blocked, color: "#94a3b8" },
    ].filter((s) => s.value > 0);

    const degreeMap = rows.reduce((acc, r) => {
      const d = r.Degree_Name || "Unknown";
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    const bars = Object.entries(degreeMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Users Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. EVENTS REPORT  —  POST /admin/events-report
// ─────────────────────────────────────────────────────────────────────────────
export const getEventsReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];

    if (filters.event_status === "Upcoming")
      where.push("e.Event_Date >= CURDATE()");
    if (filters.event_status === "Past") where.push("e.Event_Date < CURDATE()");

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows] = await db.query(
      `SELECT
        e.E_ID,
        e.Description,
        DATE_FORMAT(e.Event_Date, '%Y-%m-%d') AS Event_Date,
        DATE_FORMAT(e.Added_On,   '%Y-%m-%d') AS Added_On,
        e.Is_Active,
        s.Name AS student_name,
        CASE WHEN e.Event_Date >= CURDATE() THEN 'Upcoming' ELSE 'Past' END AS event_status
      FROM event_tbl e
      LEFT JOIN student_tbl s ON s.S_ID = e.Added_By
      ${whereClause}
      ORDER BY e.Event_Date DESC`,
      // no params — no placeholders used here
    );

    const total = rows.length;
    const active = rows.filter((r) => r.Is_Active === 1).length;
    const blocked = total - active;
    const upcoming = rows.filter((r) => r.event_status === "Upcoming").length;
    const past = total - upcoming;

    const summary = [
      { label: "Total Events", value: total },
      { label: "Upcoming", value: upcoming },
      { label: "Past", value: past },
      { label: "Blocked", value: blocked },
    ];

    const donut = [
      { label: "Upcoming", value: upcoming, color: "#f59e0b" },
      { label: "Past", value: past, color: "#94a3b8" },
    ].filter((s) => s.value > 0);

    const bars = await getMonthlyTrend("event_tbl", "Event_Date");

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Events Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GROUPS REPORT  —  POST /admin/groups-report
// ─────────────────────────────────────────────────────────────────────────────
export const getGroupsReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];
    const params = [];

    // Filter by the room's associated hobby (via chat_rooms_tbl → hobbies_tbl direct FK)
    // If your chat_rooms_tbl has a Hobby_ID column use this:
    if (filters.hobby) {
      where.push("h.Hobby_Name = ?");
      params.push(filters.hobby);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Discover date column name dynamically
    const [[colInfo]] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'chat_rooms_tbl'
       AND COLUMN_NAME IN ('Created_On','Created_At')
       LIMIT 1`,
    );
    const dateCol = colInfo?.COLUMN_NAME || null;
    const dateExpr = dateCol
      ? `DATE_FORMAT(cr.${dateCol}, '%Y-%m-%d')`
      : `NULL`;

    const [rows] = await db.query(
      `SELECT
        cr.Room_ID,
        cr.Room_Name,
        ${dateExpr} AS Created_On,
        cr.Is_Active,
        s.Name       AS student_name,
        h.Hobby_Name AS hobby_name,
        (
          SELECT COUNT(*)
          FROM chat_room_members_tbl cm2
          WHERE cm2.Room_ID = cr.Room_ID
        ) AS member_count
      FROM chat_rooms_tbl cr
      LEFT JOIN student_tbl s ON s.S_ID = cr.Created_By
      LEFT JOIN student_hobby_mapping_tbl shm ON s.S_ID = shm.Student_ID
      LEFT JOIN hobbies_tbl h  ON shm.Hobby_ID  = h.Hobby_ID
      ${whereClause}
      ORDER BY cr.Room_ID DESC`,
      params,
    );

    const total = rows.length;
    const active = rows.filter((r) => r.Is_Active === 1).length;
    const blocked = total - active;
    const totalMembers = rows.reduce(
      (sum, r) => sum + (r.member_count || 0),
      0,
    );
    const avgMembers = total > 0 ? Math.round(totalMembers / total) : 0;

    const summary = [
      { label: "Total Groups", value: total },
      { label: "Active", value: active },
      { label: "Blocked", value: blocked },
      { label: "Avg Members", value: avgMembers },
    ];

    const donut = [
      { label: "Active", value: active, color: "#9333ea" },
      { label: "Blocked", value: blocked, color: "#94a3b8" },
    ].filter((s) => s.value > 0);

    let bars = [];
    if (dateCol) {
      try {
        bars = await getMonthlyTrend("chat_rooms_tbl", dateCol);
      } catch {}
    }

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Groups Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. NOTES REPORT  —  POST /admin/notes-report
// ─────────────────────────────────────────────────────────────────────────────
export const getNotesReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];
    const params = [];

    if (filters.degree) {
      where.push("d.Degree_Name = ?");
      params.push(filters.degree);
    }
    if (filters.subject) {
      where.push("sub.Subject_Name = ?");
      params.push(filters.subject);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows] = await db.query(
      `SELECT
        n.N_ID,
        n.File_Name,
        n.Description,
        DATE_FORMAT(n.Added_On, '%Y-%m-%d') AS Added_On,
        n.Is_Active,
        s.Name           AS student_name,
        sub.Subject_Name,
        d.Degree_Name
      FROM notes_tbl n
      LEFT JOIN student_tbl s  ON s.S_ID       = n.Added_By
      LEFT JOIN subject_tbl sub ON sub.Subject_ID = n.Subject_ID
      LEFT JOIN degree_tbl d   ON d.Degree_ID   = s.Degree_ID
      ${whereClause}
      ORDER BY n.Added_On DESC`,
      params,
    );

    const total = rows.length;
    const active = rows.filter((r) => r.Is_Active === 1).length;
    const blocked = total - active;
    const uniqueAuthors = new Set(
      rows.map((r) => r.student_name).filter(Boolean),
    ).size;

    const summary = [
      { label: "Total Notes", value: total },
      { label: "Active", value: active },
      { label: "Blocked", value: blocked },
      { label: "Contributors", value: uniqueAuthors },
    ];

    const donut = [
      { label: "Active", value: active, color: "#e11d48" },
      { label: "Blocked", value: blocked, color: "#94a3b8" },
    ].filter((s) => s.value > 0);

    const bars = await getMonthlyTrend("notes_tbl", "Added_On");

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Notes Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Q&A REPORT  —  POST /admin/qna-report
// ─────────────────────────────────────────────────────────────────────────────
export const getQnAReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];
    const params = [];

    if (filters.degree) {
      where.push("d.Degree_Name = ?");
      params.push(filters.degree);
    }
    if (filters.subject) {
      where.push("sub.Subject_Name = ?");
      params.push(filters.subject);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows] = await db.query(
      `SELECT
        q.Q_ID,
        q.Question,
        DATE_FORMAT(q.Added_On, '%Y-%m-%d') AS Added_On,
        q.Is_Active,
        s.Name           AS student_name,
        sub.Subject_Name,
        d.Degree_Name,
        COUNT(a.A_ID)    AS answer_count,
        (
          SELECT a2.Answer
          FROM answer_tbl a2
          WHERE a2.Q_ID = q.Q_ID
          ORDER BY a2.A_ID ASC
          LIMIT 1
        ) AS top_answer
      FROM question_tbl q
      LEFT JOIN student_tbl s   ON s.S_ID        = q.Added_By
      LEFT JOIN degree_tbl d    ON d.Degree_ID    = s.Degree_ID
      LEFT JOIN subject_tbl sub ON sub.Subject_ID = q.Subject_ID
      LEFT JOIN answer_tbl a    ON a.Q_ID         = q.Q_ID
      ${whereClause}
      GROUP BY q.Q_ID, q.Question, q.Added_On, q.Is_Active,
               s.Name, sub.Subject_Name, d.Degree_Name
      ORDER BY q.Added_On DESC`,
      params,
    );

    const total = rows.length;
    const active = rows.filter((r) => r.Is_Active === 1).length;
    const blocked = total - active;
    const answered = rows.filter((r) => r.answer_count > 0).length;
    const unanswered = total - answered;

    const summary = [
      { label: "Total Questions", value: total },
      { label: "Active", value: active },
      { label: "Answered", value: answered },
      { label: "Unanswered", value: unanswered },
    ];

    const donut = [
      { label: "Answered", value: answered, color: "#25eb63" },
      { label: "Unanswered", value: unanswered, color: "#f59e0b" },
      { label: "Blocked", value: blocked, color: "#94a3b8" },
    ].filter((s) => s.value > 0);

    const bars = await getMonthlyTrend("question_tbl", "Added_On");

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Q&A Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMPLAINTS REPORT  —  POST /admin/complaints-report
// ─────────────────────────────────────────────────────────────────────────────
export const getComplaintsReport = async (req, res) => {
  try {
    const filters = req.body || {};
    const where = [];
    const params = [];

    if (filters.type) {
      where.push("c.Type = ?");
      params.push(filters.type);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Discover FK column name dynamically
    const [[fkCol]] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'complaint_tbl'
       AND COLUMN_NAME IN ('S_ID','Student_ID','student_id')
       LIMIT 1`,
    );
    const complaintFk = fkCol?.COLUMN_NAME || "S_ID";

    const [rows] = await db.query(
      `SELECT
        c.Complaint_ID,
        c.Complaint_Text,
        c.Type AS Complaint_Type,
        DATE_FORMAT(c.Date, '%Y-%m-%d') AS Date,
        c.Status,
        s.Name AS student_name,
        DATEDIFF(NOW(), c.Date) AS age_days
      FROM complaint_tbl c
      LEFT JOIN student_tbl s ON s.S_ID = c.${complaintFk}
      ${whereClause}
      ORDER BY c.Date DESC`,
      params,
    );

    const total = rows.length;
    const resolved = rows.filter((r) => r.Status === "Resolved").length;
    const pending = rows.filter((r) => r.Status === "Pending").length;
    const inProgress = rows.filter((r) => r.Status === "In-Progress").length;
    const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const summary = [
      { label: "Total", value: total },
      { label: "Resolved", value: resolved },
      { label: "Pending", value: pending },
      { label: "In-Progress", value: inProgress },
      { label: "Resolution %", value: resRate + "%" },
    ];

    const donut = [
      { label: "Resolved", value: resolved, color: "#25eb63" },
      { label: "Pending", value: pending, color: "#f59e0b" },
      { label: "In-Progress", value: inProgress, color: "#ef4444" },
    ].filter((s) => s.value > 0);

    const bars = await getMonthlyTrend("complaint_tbl", "Date");

    res.status(200).json({ summary, chartData: { donut, bars }, rows });
  } catch (err) {
    console.error("Complaints Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};
