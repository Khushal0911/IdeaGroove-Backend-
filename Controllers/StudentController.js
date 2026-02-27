<<<<<<< HEAD
=======
// import db from "../config/db.js";

// export const searchStudents = async (req, res) => {
//   const { q, department, page = 1, limit = 20 } = req.query; // Default limit to 20 for performance
//   const offset = (page - 1) * limit;

//   try {
//     let query = `
//       SELECT
//         s.S_ID, s.Name, s.Username, s.Profile_Pic, s.Roll_No, s.Year,
//         d.Degree_Name
//       FROM student_tbl s
//       LEFT JOIN degree_tbl d ON s.Degree_ID = d.Degree_ID
//       WHERE s.is_Active = 1
//     `;
//     const params = [];

//     if (q) {
//       query += ` AND (s.Name LIKE ? OR s.Username LIKE ?)`;
//       params.push(`%${q}%`, `%${q}%`);
//     }

//     if (department && department !== "All Departments") {
//       query += ` AND d.Degree_Name LIKE ?`;
//       params.push(`%${department}%`);
//     }

//     const [countRows] = await db.query(
//       `SELECT COUNT(*) as total FROM (${query}) as subquery`,
//       params,
//     );
//     const total = countRows[0].total;

//     query += ` ORDER BY s.Name ASC LIMIT ? OFFSET ?`;
//     params.push(parseInt(limit), parseInt(offset));

//     const [rows] = await db.query(query, params);

//     res.status(200).json({
//       status: true,
//       data: rows,
//       pagination: {
//         total,
//         page: parseInt(page),
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (err) {
//     console.error("Search Students Error:", err);
//     res.status(500).json({ status: false, error: "Failed to search students" });
//   }
// };

// export const getColleges = async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT College_ID, College_Name FROM college_tbl ORDER BY College_Name ASC");
//     res.status(200).json(rows);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch colleges" });
//   }
// };

// export const getDegrees = async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT Degree_ID, Degree_Name FROM degree_tbl ORDER BY Degree_Name ASC");
//     res.status(200).json(rows);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch degrees" });
//   }
// };

// export const getHobbies = async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT Hobby_ID, Hobby_Name FROM hobbies_tbl ORDER BY Hobby_Name ASC");
//     res.status(200).json(rows);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch hobbies" });
//   }
// };

// export const getCurrentStudent = async (req, res) => {
//   const studentId = req.params.id
//   ;
//   console.log(studentId);

//   try {
//     const [rows] = await db.query(
//       `
//       SELECT
//         s.S_ID,
//         s.Name,
//         s.Username,
//         s.Profile_Pic,
//         s.Roll_No,
//         s.Email,
//         s.Year,
//         s.College_ID,
//         s.Degree_ID,

//         c.College_Name,
//         d.Degree_Name,

//         h.Hobby_ID,
//         h.Hobby_Name

//       FROM student_tbl s

//       LEFT JOIN college_tbl c
//         ON s.College_ID = c.College_ID

//       LEFT JOIN degree_tbl d
//         ON s.Degree_ID = d.Degree_ID

//       LEFT JOIN student_hobby_mapping_tbl shm
//         ON s.S_ID = shm.Student_ID

//       LEFT JOIN hobbies_tbl h
//         ON shm.Hobby_ID = h.Hobby_ID

//       WHERE s.S_ID = ?
//       `,
//       [studentId]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Group hobbies
//     const student = {
//       S_ID: rows[0].S_ID,
//       Name: rows[0].Name,
//       Username: rows[0].Username,
//       Profile_Pic: rows[0].Profile_Pic,
//       Roll_No: rows[0].Roll_No,
//       Email: rows[0].Email,
//       Year: rows[0].Year,
//       College_ID: rows[0].College_ID,
//       Degree_ID: rows[0].Degree_ID,
//       College_Name: rows[0].College_Name,
//       Degree_Name: rows[0].Degree_Name,
//       hobbies: []
//     };

//     rows.forEach(row => {
//       if (row.Hobby_ID) {
//         student.hobbies.push({
//           Hobby_ID: row.Hobby_ID,
//           Hobby_Name: row.Hobby_Name
//         });
//       }
//     });

//     res.status(200).json(student);

//   } catch (err) {
//     console.error("Get Current Student Error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// export const updateStudent = async (req, res) => {
//   const {
//     username,
//     name,
//     roll_no,
//     college_id,
//     degree_id,
//     year,
//     email,
//     profile_pic,
//     student_id,
//     hobbies,
//   } = req.body;

//   let connection;
//   try {
//     connection = await db.getConnection();
//     await connection.beginTransaction();

//     const updateStudentQuery = `
//       UPDATE student_tbl
//       SET Username = ?, Name = ?, Roll_No = ?, College_ID = ?, Degree_ID = ?, Year = ?, Email = ?, Profile_Pic = ?
//       WHERE S_ID = ?`;

//     await connection.execute(updateStudentQuery, [
//       username,
//       name,
//       roll_no,
//       college_id,
//       degree_id,
//       year,
//       email,
//       profile_pic,
//       student_id,
//     ]);

//     if (hobbies && Array.isArray(hobbies)) {
//       await connection.query(
//         `DELETE FROM student_Hobby_Mapping_tbl WHERE Student_ID = ?`,
//         [student_id],
//       );

//       if (hobbies.length > 0) {
//         const hobbyValues = hobbies.map((hobbyId) => [student_id, hobbyId]);
//         await connection.query(
//           `INSERT INTO student_Hobby_Mapping_tbl (Student_ID, Hobby_ID) VALUES ?`,
//           [hobbyValues],
//         );
//       }
//     }

//     await connection.commit();
//     res
//       .status(200)
//       .json({ message: "Profile and hobbies updated successfully" });
//   } catch (err) {
//     if (connection) await connection.rollback();
//     console.error("Unable to update student details:", err);
//     res.status(500).json({ error: "Failed to update student details" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// export const deleteStudent = async (req, res) => {
//   const { id } = req.params;
//   let connection;
//   try {
//     connection = await db.getConnection();
//     await connection.beginTransaction();

//     const deleteStudentQuery = `UPDATE student_tbl
//         SET is_Active = 0
//         WHERE S_ID = ?`;

//     const [result] = await connection.query(deleteStudentQuery, [id]);

//     if (result.affectedRows > 0) {
//       await connection.commit();
//       res.status(200).json({
//         status: true,
//         message: "Student Deleted Successfully",
//       });
//     } else {
//       await connection.rollback();
//       res.status(404).json({
//         status: false,
//         message: "Student already deleted or not found",
//       });
//     }
//   } catch (err) {
//     if (connection) await connection.rollback();
//     console.error("Student Deletion Error", err);
//     return res.status(500).json({
//       error: "Failed to delete student",
//     });
//   } finally {
//     if (connection) connection.release();
//   }
// };

>>>>>>> df2d7c351fa17a36fb1109e30746181693db5a58
import db from "../config/db.js";

export const getPublicProfile = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        s.S_ID,
        s.Name,
        s.Username,
        s.Profile_Pic,
        s.Roll_No,
        s.Email,
        s.Year,
        s.is_Active,

        s.College_ID,
        c.College_Name,

        s.Degree_ID,
        d.Degree_Name,

        (SELECT COUNT(*) 
         FROM notes_tbl n 
         WHERE n.Added_By = s.S_ID AND n.Is_Active = 1) AS notes_count,

        (SELECT COUNT(*) 
         FROM question_tbl q 
         WHERE q.Added_By = s.S_ID AND q.Is_Active = 1) AS questions_count,

        (SELECT COUNT(*) 
         FROM event_tbl e 
         WHERE e.Added_By = s.S_ID AND e.Is_Active = 1) AS events_count,

        (SELECT COUNT(*) 
         FROM complaint_tbl comp 
         WHERE comp.Student_ID = s.S_ID AND comp.Is_Active = 1) AS complaints_count,

        (SELECT COUNT(*) 
         FROM chat_room_members_tbl crm 
         WHERE crm.Student_ID = s.S_ID AND crm.Is_Active = 1) AS groups_count

      FROM student_tbl s

      LEFT JOIN college_tbl c 
        ON s.College_ID = c.College_ID

      LEFT JOIN degree_tbl d 
        ON s.Degree_ID = d.Degree_ID

      WHERE s.S_ID = ?
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getStudentActivities = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;

  try {
    let query = "";
    let params = [id];

    switch (type) {
      case "Notes":
        query = `
          SELECT N_ID as id, Description as title, Added_On as date
          FROM notes_tbl
          WHERE Added_By = ? AND Is_Active = 1
          ORDER BY Added_On DESC
        `;
        break;

      case "QnA":
        query = `
          SELECT q.Q_ID as id, q.Question as title, q.Added_On as date, d.Degree_Name as course, s.Subject_Name as type 
          FROM question_tbl q
          LEFT JOIN degree_tbl d ON d.Degree_ID = q.Degree_ID
          LEFT JOIN subject_tbl s ON s.Subject_ID = q.Subject_ID
          WHERE Added_By = ? AND Is_Active = 1
          ORDER BY Added_On DESC
        `;
        break;

      case "Events":
        query = `
          SELECT E_ID as id, Description as title, Added_On as date
          FROM event_tbl
          WHERE Added_By = ? AND Is_Active = 1
          ORDER BY Added_On DESC
        `;
        break;

      case "Complaints":
        query = `
          SELECT Complaint_ID as id, Complaint_Text as title, Date as date
          FROM complaint_tbl
          WHERE Student_ID = ? AND Is_Active = 1
          ORDER BY Date DESC
        `;
        break;

      case "Groups":
        query = `
          SELECT Member_ID as id, Role as title, Joined_On as date
          FROM chat_room_members_tbl
          WHERE Student_ID = ? AND Is_Active = 1
          ORDER BY Joined_On DESC
        `;
        break;

      default:
        return res.status(400).json({ error: "Invalid type" });
    }

    const [rows] = await db.query(query, params);

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
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

    // Group students with their hobbies
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
/* ===============================
    META DATA CONTROLLERS
   (Used for Searchable Dropdowns)
================================= */

// Fetch all colleges for the searchable datalist
export const getColleges = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT College_ID, College_Name FROM college_tbl ORDER BY College_Name ASC",
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Fetch Colleges Error:", err);
    res.status(500).json({ error: "Failed to fetch colleges" });
  }
};

// Fetch all degrees for the searchable datalist
export const getDegrees = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT Degree_ID, Degree_Name FROM degree_tbl ORDER BY Degree_Name ASC",
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Fetch Degrees Error:", err);
    res.status(500).json({ error: "Failed to fetch degrees" });
  }
};

// Fetch all hobbies for the searchable chip-selection
export const getHobbies = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT Hobby_ID, Hobby_Name FROM hobbies_tbl ORDER BY Hobby_Name ASC",
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Fetch Hobbies Error:", err);
    res.status(500).json({ error: "Failed to fetch hobbies" });
  }
};

/* ===============================
    PROFILE & UPDATE CONTROLLERS
================================= */

export const getCurrentStudent = async (req, res) => {
  const studentId = req.params.id;

  try {
    const [rows] = await db.query(
      `
      SELECT 
        s.S_ID, s.Name, s.Username, s.Profile_Pic, s.Roll_No, s.Email, s.Year, 
        s.College_ID, s.Degree_ID, c.College_Name, d.Degree_Name,
        h.Hobby_ID, h.Hobby_Name
      FROM student_tbl s
      LEFT JOIN college_tbl c ON s.College_ID = c.College_ID
      LEFT JOIN degree_tbl d ON s.Degree_ID = d.Degree_ID
      LEFT JOIN student_hobby_mapping_tbl shm ON s.S_ID = shm.Student_ID
      LEFT JOIN hobbies_tbl h ON shm.Hobby_ID = h.Hobby_ID
      WHERE s.S_ID = ?
      `,
      [studentId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Initialize object with the first row's data
    const student = {
      S_ID: rows[0].S_ID,
      Name: rows[0].Name,
      Username: rows[0].Username,
      Profile_Pic: rows[0].Profile_Pic,
      Roll_No: rows[0].Roll_No,
      Email: rows[0].Email,
      Year: rows[0].Year,
      College_ID: rows[0].College_ID,
      Degree_ID: rows[0].Degree_ID,
      College_Name: rows[0].College_Name,
      Degree_Name: rows[0].Degree_Name,
      hobbies: [],
    };

    // Group hobbies into an array
    rows.forEach((row) => {
      if (row.Hobby_ID) {
        student.hobbies.push({
          Hobby_ID: row.Hobby_ID,
          Hobby_Name: row.Hobby_Name,
        });
      }
    });

    res.status(200).json(student);
  } catch (err) {
    console.error("Get Current Student Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// IdeaGroove-Backend -> controllers -> StudentController.js

export const updateStudent = async (req, res) => {
  const {
    student_id,
    username,
    name,
    roll_no,
    college_id,
    degree_id,
    year,
    email,
    hobbies,
  } = req.body;

  const profile_pic = req.file ? req.file.path : undefined;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Fetch current data to use as fallback for any undefined fields
    const [current] = await connection.query(
      "SELECT * FROM student_tbl WHERE S_ID = ?",
      [student_id],
    );
    if (current.length === 0)
      return res.status(404).json({ error: "Student not found" });
    const old = current[0];

    // 2. Prepare parameters: Use new value if provided, otherwise keep the old one
    // This prevents the "undefined" bind parameter error
    const params = [
      username !== undefined ? username : old.Username,
      name !== undefined ? name : old.Name,
      roll_no !== undefined ? roll_no : old.Roll_No,
      college_id !== undefined ? college_id : old.College_ID,
      degree_id !== undefined ? degree_id : old.Degree_ID,
      year !== undefined ? year : old.Year,
      email !== undefined ? email : old.Email,
      profile_pic !== undefined ? profile_pic : old.Profile_Pic,
      student_id,
    ];

    const updateQuery = `
      UPDATE student_tbl 
      SET Username = ?, Name = ?, Roll_No = ?, College_ID = ?, Degree_ID = ?, Year = ?, Email = ?, Profile_Pic = ? 
      WHERE S_ID = ?`;

    await connection.execute(updateQuery, params);

    // 3. Sync Hobbies
    if (hobbies && Array.isArray(hobbies)) {
      await connection.query(
        "DELETE FROM student_hobby_mapping_tbl WHERE Student_ID = ?",
        [student_id],
      );
      if (hobbies.length > 0) {
        const hobbyValues = hobbies.map((id) => [student_id, id]);
        await connection.query(
          "INSERT INTO student_hobby_mapping_tbl (Student_ID, Hobby_ID) VALUES ?",
          [hobbyValues],
        );
      }
    }

    await connection.commit();

    res.status(200).json({ message: "Update successful" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Critical Update Error:", err);
    res.status(500).json({ error: "Server error during update" });
  } finally {
    if (connection) connection.release();
  }
};
/* ===============================
    OTHER STUDENT UTILITIES
================================= */

export const searchStudents = async (req, res) => {
  const { q, department, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        s.S_ID, s.Name, s.Username, s.Profile_Pic, s.Roll_No, s.Year,
        d.Degree_Name
      FROM student_tbl s
      LEFT JOIN degree_tbl d ON s.Degree_ID = d.Degree_ID
      WHERE s.is_Active = 1
    `;
    const params = [];

    if (q) {
      query += ` AND (s.Name LIKE ? OR s.Username LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    if (department && department !== "All Departments") {
      query += ` AND d.Degree_Name LIKE ?`;
      params.push(`%${department}%`);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM (${query}) as subquery`,
      params,
    );
    const total = countRows[0].total;

    query += ` ORDER BY s.Name ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);

    res.status(200).json({
      status: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Search Students Error:", err);
    res.status(500).json({ status: false, error: "Failed to search students" });
  }
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const deleteStudentQuery = `UPDATE student_tbl SET is_Active = 0 WHERE S_ID = ?`;
    const [result] = await connection.query(deleteStudentQuery, [id]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Student Deleted Successfully" });
    } else {
      await connection.rollback();
      res.status(404).json({ status: false, message: "Student not found" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Student Deletion Error", err);
    return res.status(500).json({ error: "Failed to delete student" });
  } finally {
    if (connection) connection.release();
  }
};
