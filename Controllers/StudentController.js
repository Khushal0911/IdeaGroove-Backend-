import db from "../config/db.js";

export const getPublicProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await db.query(
      "SELECT Name, Username, Profile_Pic, College_Name, Degree_Name FROM student_tbl WHERE S_ID = ?",
      [id],
    );
    if (user.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.status(200).json(user[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
