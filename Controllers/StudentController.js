import db from "../config/db.js";

export const getPublicProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await db.query(
      "SELECT Name, Username, Profile_Pic, College_ID, Degree_ID FROM student_tbl WHERE S_ID = ?",
      [id],
    );
    if (user.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.status(200).json(user[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const getAllStudents = async (req, res) => {
  try {
    const [rows] = await db.query(`
  SELECT 
    s.S_ID,
    s.Username,
    s.Name,
    s.Roll_No,
    s.Year,
    s.Email,
    s.Profile_Pic,
    s.is_Active,

    c.College_ID,
    c.College_Name,
    c.City,
    c.State,

    d.Degree_ID,
    d.Degree_Name,

    h.Hobby_ID,
    h.Hobby_Name

  FROM student_tbl s

  LEFT JOIN college_tbl c 
    ON s.College_ID = c.College_ID

  LEFT JOIN degree_tbl d 
    ON s.Degree_ID = d.Degree_ID

  LEFT JOIN student_hobby_mapping_tbl shm 
    ON s.S_ID = shm.Student_ID

  LEFT JOIN hobbies_tbl h 
    ON shm.Hobby_ID = h.Hobby_ID

  ORDER BY s.S_ID
`);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Users not found" });
    }

    // 🔥 Group students with their hobbies
    const studentsMap = {};

    rows.forEach((row) => {
      if (!studentsMap[row.S_ID]) {
        studentsMap[row.S_ID] = {
          S_ID: row.S_ID,
          Username: row.Username,
          Name: row.Name,
          Roll_No: row.Roll_No,
          College_ID: row.College_ID,
          Degree_ID: row.Degree_ID,
          Year: row.Year,
          Email: row.Email,
          Profile_Pic: row.Profile_Pic,
          is_Active: row.is_Active,

          College: {
            College_ID: row.College_ID,
            College_Name: row.College_Name,
            City: row.City,
            State: row.State,
          },

          Degree: {
            Degree_ID: row.Degree_ID,
            Degree_Name: row.Degree_Name,
          },
          hobbies: [],
        };
      }

      // If hobby exists, push into array
      if (row.Hobby_ID) {
        studentsMap[row.S_ID].hobbies.push({
          Hobby_ID: row.Hobby_ID,
          Hobby_Name: row.Hobby_Name,
        });
      }
    });

    const students = Object.values(studentsMap);

    res.status(200).json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
