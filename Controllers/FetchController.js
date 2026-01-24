import db from "../config/db.js";

export const getData = async (req, res) => {
  try {
    const [colleges] = await db.query(
      "SELECT College_ID, College_Name FROM college_tbl",
    );
    const [degrees] = await db.query(
      "SELECT Degree_ID, Degree_Name FROM degree_tbl",
    );
    const [hobbies] = await db.query(
      "SELECT Hobby_ID, Hobby_Name FROM hobbies_tbl",
    );

    res.json({ colleges, degrees, hobbies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch form resources." });
  }
};

export const searchColleges = async (req, res) => {
  const term = req.query.q || "";
  try {
    const [results] = await db.query(
      "SELECT College_ID, College_Name FROM college_tbl WHERE College_Name LIKE ? LIMIT 10",
      [`%${term}%`],
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const searchDegrees = async (req, res) => {
  const term = req.query.q || "";
  try {
    const [results] = await db.query(
      "SELECT Degree_ID, Degree_Name FROM degree_tbl WHERE Degree_Name LIKE ? LIMIT 10",
      [`%${term}%`],
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const searchHobbies = async (req, res) => {
  const term = req.query.q || "";
  try {
    const [results] = await db.query(
      "SELECT Hobby_ID, Hobby_Name FROM hobbies_tbl WHERE Hobby_Name LIKE ? LIMIT 10",
      [`%${term}%`],
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getStudentByDetails = async (req, res) => {
  try {
    const { username, name } = req.query;

    if (!username || !name) {
      return res.status(400).json({
        success: false,
        message: "Please provide both Username and Name.",
      });
    }

    const sql = `
      SELECT S_ID, Name, Username, Email, Roll_No, Year, Profile_Pic 
      FROM student_tbl 
      WHERE Username = ? OR Name = ?
    `;

    const [rows] = await db.query(sql, [username, name]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Server Error fetching user details.",
    });
  }
};
