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

export const getPlatformHealthScore = async (req, res) => {
  try {
    // Total & active users
    const [[{ totalUsers }]] = await db.query(
      `SELECT COUNT(*) AS totalUsers FROM student_tbl WHERE is_Active = 1`,
    );

    // Students who have posted at least one thing
    const [[{ activePosters }]] = await db.query(`
      SELECT COUNT(DISTINCT student_id) AS activePosters FROM (
        SELECT Added_By AS student_id FROM notes_tbl     WHERE Is_Active = 1
        UNION ALL
        SELECT Added_By AS student_id FROM question_tbl  WHERE Is_Active = 1
        UNION ALL
        SELECT Added_By AS student_id FROM event_tbl     WHERE Is_Active = 1
        UNION ALL
        SELECT Created_By AS student_id FROM chat_rooms_tbl WHERE Is_Active = 1
      ) t
    `);

    // Total content vs blocked content
    const [[{ totalContent }]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM notes_tbl)      +
        (SELECT COUNT(*) FROM question_tbl)   +
        (SELECT COUNT(*) FROM event_tbl)      +
        (SELECT COUNT(*) FROM chat_rooms_tbl) AS totalContent
    `);

    const [[{ blockedContent }]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM notes_tbl      WHERE Is_Active = 0) +
        (SELECT COUNT(*) FROM question_tbl   WHERE Is_Active = 0) +
        (SELECT COUNT(*) FROM event_tbl      WHERE Is_Active = 0) +
        (SELECT COUNT(*) FROM chat_rooms_tbl WHERE Is_Active = 0) AS blockedContent
    `);

    // Unresolved complaints
    const [[{ unresolvedComplaints }]] = await db.query(
      `SELECT COUNT(*) AS unresolvedComplaints FROM complaint_tbl WHERE Status != 'Resolved'`,
    );
    const [[{ totalComplaints }]] = await db.query(
      `SELECT COUNT(*) AS totalComplaints FROM complaint_tbl`,
    );

    // Total contributions for avg depth
    const [[{ totalContributions }]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM notes_tbl      WHERE Is_Active = 1) +
        (SELECT COUNT(*) FROM question_tbl   WHERE Is_Active = 1) +
        (SELECT COUNT(*) FROM event_tbl      WHERE Is_Active = 1) +
        (SELECT COUNT(*) FROM chat_rooms_tbl WHERE Is_Active = 1) AS totalContributions
    `);

    // ── Score calculations ─────────────────────────────────
    // 1. Activity Rate (30 pts): % of users who have posted at least once
    const activityRate = totalUsers > 0 ? activePosters / totalUsers : 0;
    const activityScore = Math.round(activityRate * 30);

    // 2. Content Quality (25 pts): % of content that is NOT blocked
    const activeContent = totalContent - blockedContent;
    const qualityRate = totalContent > 0 ? activeContent / totalContent : 1;
    const qualityScore = Math.round(qualityRate * 25);

    // 3. Complaint Rate (25 pts): inverse of unresolved ratio
    const complaintRate =
      totalComplaints > 0 ? unresolvedComplaints / totalComplaints : 0;
    const complaintScore = Math.round((1 - complaintRate) * 25);

    // 4. Engagement Depth (20 pts): avg contributions per active user
    //    Benchmark: 5+ contributions per user = full score
    const avgContribs =
      activePosters > 0 ? totalContributions / activePosters : 0;
    const depthScore = Math.min(Math.round((avgContribs / 5) * 20), 20);

    const totalScore =
      activityScore + qualityScore + complaintScore + depthScore;

    // Health label
    const healthLabel =
      totalScore >= 80
        ? "Excellent"
        : totalScore >= 60
          ? "Good"
          : totalScore >= 40
            ? "Fair"
            : "Needs Attention";

    res.status(200).json({
      totalScore,
      healthLabel,
      breakdown: {
        activityScore,
        activityRate: Math.round(activityRate * 100),
        qualityScore,
        qualityRate: Math.round(qualityRate * 100),
        complaintScore,
        complaintRate: Math.round(complaintRate * 100),
        depthScore,
        avgContributions: Math.round(avgContribs * 10) / 10,
      },
      meta: {
        totalUsers,
        activePosters,
        totalContent,
        blockedContent,
        totalComplaints,
        unresolvedComplaints,
        totalContributions,
      },
    });
  } catch (err) {
    console.error("Platform Health Score Error:", err);
    res.status(500).json({ error: "Failed to compute platform health score" });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. AT-RISK STUDENTS
//    GET /admin/at-risk-students?days=30
//
//    Students who:
//      - Posted at least once BEFORE the silence window
//      - Have posted NOTHING within the last `days` days
// ─────────────────────────────────────────────────────────────
export const getAtRiskStudents = async (req, res) => {
  const days = parseInt(req.query.days) || 30;

  try {
    const [rows] = await db.query(
      `
      SELECT
        s.S_ID,
        s.Name,
        s.Email,
        s.Profile_Pic,
        d.Degree_Name,
        s.Year,

        -- Last activity date across all content types
        MAX(last_activity.last_date) AS last_active_on,

        -- Total lifetime contributions
        COUNT(DISTINCT all_activity.activity_id) AS total_contributions,

        -- Days since last activity
        DATEDIFF(NOW(), MAX(last_activity.last_date)) AS days_silent

      FROM student_tbl s
      LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID

      -- Get their most recent post date per type
      JOIN (
        SELECT Added_By AS student_id, MAX(Added_On) AS last_date FROM notes_tbl     GROUP BY Added_By
        UNION ALL
        SELECT Added_By AS student_id, MAX(Added_On) AS last_date FROM question_tbl  GROUP BY Added_By
        UNION ALL
        SELECT Added_By AS student_id, MAX(Added_On) AS last_date FROM event_tbl     GROUP BY Added_By
        UNION ALL
        SELECT Created_By AS student_id, MAX(Created_On) AS last_date FROM chat_rooms_tbl GROUP BY Created_By
      ) last_activity ON last_activity.student_id = s.S_ID

      -- Get all lifetime contributions for count
      JOIN (
        SELECT Added_By AS student_id, N_ID   AS activity_id FROM notes_tbl
        UNION ALL
        SELECT Added_By AS student_id, Q_ID   AS activity_id FROM question_tbl
        UNION ALL
        SELECT Added_By AS student_id, E_ID   AS activity_id FROM event_tbl
        UNION ALL
        SELECT Created_By AS student_id, Room_ID AS activity_id FROM chat_rooms_tbl
      ) all_activity ON all_activity.student_id = s.S_ID

      WHERE s.is_Active = 1

      GROUP BY s.S_ID, s.Name, s.Email, s.Profile_Pic, d.Degree_Name, s.Year
      HAVING 
        days_silent >= ?
        AND total_contributions > 0

      ORDER BY days_silent DESC
    `,
      [days],
    );

    res.status(200).json({
      days,
      count: rows.length,
      students: rows,
    });
  } catch (err) {
    console.error("At-Risk Students Error:", err);
    res.status(500).json({ error: "Failed to fetch at-risk students" });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. INACTIVE STUDENTS (never posted)
//    GET /admin/inactive-students?days=60
//
//    Students who have NEVER posted anything
//    OR joined more than `days` days ago and still have 0 posts
// ─────────────────────────────────────────────────────────────
export const getInactiveStudents = async (req, res) => {
  const days = parseInt(req.query.days) || 60;

  try {
    const [rows] = await db.query(
      `
      SELECT
        s.S_ID,
        s.Name,
        s.Email,
        s.Profile_Pic,
        d.Degree_Name,
        s.Year,
        s.Created_At,
        DATEDIFF(NOW(), s.Created_At) AS days_since_joined

      FROM student_tbl s
      LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID

      WHERE s.is_Active = 1

        -- Account is older than the threshold
        AND DATEDIFF(NOW(), s.Created_At) >= ?

        -- Has never posted anything
        AND s.S_ID NOT IN (SELECT DISTINCT Added_By   FROM notes_tbl)
        AND s.S_ID NOT IN (SELECT DISTINCT Added_By   FROM question_tbl)
        AND s.S_ID NOT IN (SELECT DISTINCT Added_By   FROM event_tbl)
        AND s.S_ID NOT IN (SELECT DISTINCT Created_By FROM chat_rooms_tbl)

      ORDER BY days_since_joined DESC
    `,
      [days],
    );

    res.status(200).json({
      days,
      count: rows.length,
      students: rows,
    });
  } catch (err) {
    console.error("Inactive Students Error:", err);
    res.status(500).json({ error: "Failed to fetch inactive students" });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. MOST COMPLAINED-ABOUT STUDENTS
//    GET /admin/most-complained-students
//
//    Students ranked by how many complaints were filed against
//    their content (notes, questions, events) or directly
// ─────────────────────────────────────────────────────────────
export const getMostComplainedStudents = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.S_ID,
        s.Name,
        s.Email,
        s.Profile_Pic,
        d.Degree_Name,
        s.is_Active,

        COUNT(c.Complaint_ID)                                          AS total_complaints,
        SUM(c.Status = 'Resolved')                                     AS resolved,
        SUM(c.Status = 'In-Progress')                                  AS in_progress,
        SUM(c.Status = 'Pending')                                      AS pending,

        -- Most recent complaint date
        MAX(c.Date)                                                    AS latest_complaint_on,

        -- How many of their own posts are blocked
        (
          SELECT COUNT(*) FROM notes_tbl      WHERE Added_By   = s.S_ID AND Is_Active = 0
        ) + (
          SELECT COUNT(*) FROM question_tbl   WHERE Added_By   = s.S_ID AND Is_Active = 0
        ) + (
          SELECT COUNT(*) FROM event_tbl      WHERE Added_By   = s.S_ID AND Is_Active = 0
        )                                                              AS blocked_content_count

      FROM student_tbl s
      LEFT JOIN degree_tbl d    ON d.Degree_ID   = s.Degree_ID
      JOIN      complaint_tbl c ON c.Student_ID  = s.S_ID

      GROUP BY s.S_ID, s.Name, s.Email, s.Profile_Pic, d.Degree_Name, s.is_Active

      ORDER BY total_complaints DESC
      LIMIT 20
    `);

    res.status(200).json({
      count: rows.length,
      students: rows,
    });
  } catch (err) {
    console.error("Most Complained Students Error:", err);
    res.status(500).json({ error: "Failed to fetch most complained students" });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. CONTENT BLOCK INDEX (per subject & degree)
//    GET /admin/content-block-index
//
//    Which subjects/degrees have the worst block ratio
//    so admin knows where content quality is lowest
// ─────────────────────────────────────────────────────────────
export const getContentBlockIndex = async (req, res) => {
  try {
    // Per-subject block ratio (notes only, since notes are tied to subjects)
    const [bySubject] = await db.query(`
      SELECT
        sub.Subject_ID,
        sub.Subject_Name,
        d.Degree_Name,
        COUNT(n.N_ID)                              AS total_notes,
        SUM(n.Is_Active = 0)                       AS blocked_notes,
        SUM(n.Is_Active = 1)                       AS active_notes,
        ROUND(SUM(n.Is_Active = 0) / COUNT(n.N_ID) * 100, 1) AS block_rate_pct

      FROM notes_tbl n
      JOIN subject_tbl sub ON sub.Subject_ID = n.Subject_ID
      JOIN degree_tbl  d   ON d.Degree_ID    = sub.Degree_ID

      GROUP BY sub.Subject_ID, sub.Subject_Name, d.Degree_Name
      HAVING total_notes >= 3          -- ignore subjects with too few posts
      ORDER BY block_rate_pct DESC
      LIMIT 15
    `);

    // Per-degree block ratio (all content types combined)
    const [byDegree] = await db.query(`
      SELECT
        d.Degree_ID,
        d.Degree_Name,

        -- Notes
        SUM(CASE WHEN content_type = 'Note'     THEN 1 ELSE 0 END) AS total_notes,
        SUM(CASE WHEN content_type = 'Note'     AND is_blocked = 1 THEN 1 ELSE 0 END) AS blocked_notes,

        -- Questions
        SUM(CASE WHEN content_type = 'Question' THEN 1 ELSE 0 END) AS total_questions,
        SUM(CASE WHEN content_type = 'Question' AND is_blocked = 1 THEN 1 ELSE 0 END) AS blocked_questions,

        COUNT(*) AS total_content,
        SUM(is_blocked)                                             AS total_blocked,
        ROUND(SUM(is_blocked) / COUNT(*) * 100, 1)                 AS overall_block_rate_pct

      FROM (
        SELECT n.Degree_ID, 'Note' AS content_type, (1 - n.Is_Active) AS is_blocked
        FROM notes_tbl n

        UNION ALL

        SELECT q.Degree_ID, 'Question' AS content_type, (1 - q.Is_Active) AS is_blocked
        FROM question_tbl q
      ) combined

      JOIN degree_tbl d ON d.Degree_ID = combined.Degree_ID
      GROUP BY d.Degree_ID, d.Degree_Name
      HAVING total_content >= 3
      ORDER BY overall_block_rate_pct DESC
    `);

    res.status(200).json({
      bySubject,
      byDegree,
    });
  } catch (err) {
    console.error("Content Block Index Error:", err);
    res.status(500).json({ error: "Failed to fetch content block index" });
  }
};

// ─────────────────────────────────────────────────────────────
// 6. COMPLAINTS REPORT
//    GET /admin/complaints-report
//
//    Full complaints data with resolution stats,
//    average resolution time, and breakdown by status
// ─────────────────────────────────────────────────────────────
export const getComplaintsReport = async (req, res) => {
  try {
    // Summary stats
    const [[summary]] = await db.query(`
      SELECT
        COUNT(*)                                       AS total,
        SUM(Status = 'Resolved')                       AS resolved,
        SUM(Status = 'In-Progress')                    AS in_progress,
        SUM(Status = 'Pending')                        AS pending,
        ROUND(SUM(Status = 'Resolved') / COUNT(*) * 100, 1) AS resolution_rate_pct,

        -- Average days to resolve (only for resolved complaints)
        ROUND(AVG(
          CASE WHEN Status = 'Resolved'
            THEN DATEDIFF(Updated_At, Date)
          END
        ), 1) AS avg_resolution_days

      FROM complaint_tbl
    `);

    // Monthly trend (last 12 months)
    const [monthlyTrend] = await db.query(`
      SELECT
        DATE_FORMAT(Date, '%Y-%m') AS month,
        COUNT(*)                   AS total,
        SUM(Status = 'Resolved')   AS resolved,
        SUM(Status = 'Pending')    AS pending
      FROM complaint_tbl
      WHERE Date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // Full complaint list with student info
    const [complaints] = await db.query(`
      SELECT
        c.Complaint_ID,
        c.Complaint_Text,
        c.Status,
        c.Date          AS filed_on,
        c.Updated_At    AS updated_on,
        DATEDIFF(COALESCE(c.Updated_At, NOW()), c.Date) AS age_days,

        s.S_ID          AS student_id,
        s.Name          AS student_name,
        s.Email         AS student_email,
        s.Profile_Pic   AS student_pic,
        d.Degree_Name

      FROM complaint_tbl c
      JOIN student_tbl s ON s.S_ID = c.Student_ID
      LEFT JOIN degree_tbl d ON d.Degree_ID = s.Degree_ID

      ORDER BY c.Date DESC
    `);

    res.status(200).json({
      summary,
      monthlyTrend,
      complaints,
    });
  } catch (err) {
    console.error("Complaints Report Error:", err);
    res.status(500).json({ error: "Failed to fetch complaints report" });
  }
};
