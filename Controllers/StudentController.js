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

        c.College_Name,
        c.City,
        c.State,

        d.Degree_Name,

        -- Dynamic Stats (Subqueries instead of joins)

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
          SELECT Q_ID as id, Question as title, Added_On as date
          FROM question_tbl
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
