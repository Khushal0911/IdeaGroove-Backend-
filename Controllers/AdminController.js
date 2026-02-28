import bcrypt from "bcryptjs";
import db from "../config/db.js";
import jwt from "jsonwebtoken"; // Import JWT
import nodemailer from "nodemailer";
import { sendBlockEmail, sendUnblockEmail } from "../services/emailService.js";

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
      "SELECT COUNT(*) AS total FROM complaint_tbl WHERE status = 'pending'",
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

export const updateComplaintStatus = async (req, res) => {
  const { id, status } = req.body;

  try {
    const [result] = await db.query(
      `
      UPDATE complaint_tbl
      SET status = ?
      WHERE Complaint_ID = ?
      `,
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Complaint not found",
      });
    }

    res.json({
      message: "Complaint status updated successfully",
    });
  } catch (err) {
    console.error("Complaint Status Updation Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

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
  LIMIT 10
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
};

const getContentWithOwner = async (type, id) => {
  const config = CONTENT_CONFIG[type];
  if (!config) throw new Error(`Unknown content type: ${type}`);

  const { table, idColumn, titleCol, alias, ownerCol } = config;

  // Add this to see what db.query actually returns
  const result = await db.query(
    `SELECT
       ${alias}.${idColumn} AS content_id,
       ${alias}.${titleCol} AS content_title,
       ${alias}.Is_Active,
       s.S_ID AS owner_id,
       s.name AS owner_name,
       s.email AS owner_email
     FROM ${table} ${alias}
     JOIN student_tbl s ON s.S_ID = ${alias}.${ownerCol}
     WHERE ${alias}.${idColumn} = ?`,
    [id],
  );

  console.log("Query result type:", typeof result, Array.isArray(result));
  console.log("Query result:", result);

  const rows = result[0]; // ✅ data array
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
      await sendBlockEmail({
        toEmail: content.owner_email,
        studentName: content.owner_name,
        contentType: config.label,
        contentTitle: content.content_title,
        reason: reason || null,
      });
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
      await sendUnblockEmail({
        toEmail: content.owner_email,
        studentName: content.owner_name,
        contentType: config.label,
        contentTitle: content.content_title,
      });
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

// ─── TOGGLE (single endpoint for both block/unblock) ─────────────────────────
// POST /api/admin/toggle-block
// Body: { type, id, reason? }
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
