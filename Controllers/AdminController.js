import bcrypt from "bcryptjs";
import db from "../config/db.js";
import jwt from "jsonwebtoken"; // Import JWT
import nodemailer from "nodemailer";

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
