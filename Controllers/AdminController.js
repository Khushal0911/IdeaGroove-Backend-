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
      "SELECT COUNT(*) AS total FROM event_tbl WHERE Event_Date >= CURDATE()",
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
