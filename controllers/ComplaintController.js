import db from "../config/database.js";

const buildComplaintContentExpressions = () => {
  const titleExpression = `
    CASE
      WHEN LOWER(c.Type) = 'question' THEN COALESCE(q.Question, 'Reported question not available')
      WHEN LOWER(c.Type) = 'answer' THEN COALESCE(a.Answer, 'Reported answer not available')
      WHEN LOWER(c.Type) = 'notes' THEN COALESCE(n.Description, n.File_Name, 'Reported note not available')
      WHEN LOWER(c.Type) = 'groups' THEN COALESCE(cr.Room_Name, 'Reported group not available')
      WHEN LOWER(c.Type) = 'event' THEN COALESCE(e.Description, 'Reported event not available')
      WHEN LOWER(c.Type) = 'user' THEN CONCAT('@', COALESCE(s_reported.Username, 'unknown-user'))
      WHEN LOWER(c.Type) = 'other' THEN 'IdeaGroove platform'
      ELSE 'Reported activity'
    END
  `;

  const ownerExpression = `
    COALESCE(
      sq.Username,
      sa.Username,
      sn.Username,
      scr.Username,
      se.Username,
      s_reported.Username,
      'N/A'
    )
  `;

  const activityExpression = `
    CASE
      WHEN LOWER(c.Type) = 'question' THEN CONCAT('Question: ', COALESCE(q.Question, 'Reported question not available'))
      WHEN LOWER(c.Type) = 'answer' THEN CONCAT('Answer: ', COALESCE(a.Answer, 'Reported answer not available'))
      WHEN LOWER(c.Type) = 'notes' THEN CONCAT('Notes: ', COALESCE(n.Description, n.File_Name, 'Reported note not available'))
      WHEN LOWER(c.Type) = 'groups' THEN CONCAT('Group: ', COALESCE(cr.Room_Name, 'Reported group not available'))
      WHEN LOWER(c.Type) = 'event' THEN CONCAT('Event: ', COALESCE(e.Description, 'Reported event not available'))
      WHEN LOWER(c.Type) = 'user' THEN CONCAT('User: @', COALESCE(s_reported.Username, 'unknown-user'))
      WHEN LOWER(c.Type) = 'other' THEN 'Other: IdeaGroove platform'
      ELSE 'Reported activity'
    END
  `;

  return { titleExpression, ownerExpression, activityExpression };
};

const complaintContextSelect = `
  CASE
    WHEN LOWER(c.Type) = 'question' THEN q.Q_ID
    WHEN LOWER(c.Type) = 'answer' THEN aq.Q_ID
    ELSE NULL
  END AS Question_ID,
  CASE
    WHEN LOWER(c.Type) = 'question' THEN q.Question
    WHEN LOWER(c.Type) = 'answer' THEN aq.Question
    ELSE NULL
  END AS Question_Text,
  CASE
    WHEN LOWER(c.Type) = 'notes' THEN COALESCE(n.File_Name, n.Note_File)
    ELSE NULL
  END AS Note_File_Name,
  CASE
    WHEN LOWER(c.Type) = 'notes' THEN n.Note_File
    ELSE NULL
  END AS Note_File_URL,
  CASE
    WHEN LOWER(c.Type) = 'notes' THEN n.Description
    ELSE NULL
  END AS Note_Description,
  CASE
    WHEN LOWER(c.Type) = 'notes' THEN nsub.Subject_Name
    ELSE NULL
  END AS Note_Subject_Name,
  CASE
    WHEN LOWER(c.Type) = 'event' THEN e.Event_Date
    ELSE NULL
  END AS Event_Date,
  CASE
    WHEN LOWER(c.Type) = 'event' THEN e.Poster_File
    ELSE NULL
  END AS Event_Poster_URL,
  CASE
    WHEN LOWER(c.Type) = 'groups' THEN cr.Description
    ELSE NULL
  END AS Group_Description,
  CASE
    WHEN LOWER(c.Type) = 'groups' THEN gh.Hobby_Name
    ELSE NULL
  END AS Group_Based_On,
  CASE
    WHEN LOWER(c.Type) = 'user' THEN s_reported.S_ID
    ELSE NULL
  END AS Reported_User_ID,
  CASE
    WHEN LOWER(c.Type) = 'user' THEN s_reported.Name
    ELSE NULL
  END AS Reported_User_Name,
  CASE
    WHEN LOWER(c.Type) = 'user' THEN s_reported.Username
    ELSE NULL
  END AS Reported_User_Username
`;

const complaintContextJoins = `
  LEFT JOIN question_tbl aq ON c.Type = 'answer' AND a.Q_ID = aq.Q_ID
  LEFT JOIN subject_tbl nsub ON c.Type = 'notes' AND n.Subject_ID = nsub.Subject_ID
  LEFT JOIN hobbies_tbl gh ON c.Type = 'groups' AND cr.Based_On = gh.Hobby_ID
`;

export const getAllComplaints = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const { titleExpression, ownerExpression, activityExpression } =
      buildComplaintContentExpressions();

    const [[studentFkRow]] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'complaint_tbl'
       AND COLUMN_NAME IN ('S_ID', 'Student_ID', 'Student_Id', 'student_id')
       LIMIT 1`,
    );

    const complaintStudentFk = studentFkRow?.COLUMN_NAME || "Student_ID";

    let conditions = ["c.Is_Active = 1"];
    const queryParams = [];

    if (search) {
      conditions.push(
        `(
          c.Complaint_Text LIKE ?
          OR s.Name LIKE ?
          OR c.Type LIKE ?
          OR ${titleExpression} LIKE ?
          OR ${activityExpression} LIKE ?
          OR ${ownerExpression} LIKE ?
        )`,
      );
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
      );
    }

    const whereClause = conditions.join(" AND ");

    // Get total count for pagination
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total
       FROM complaint_tbl c
       LEFT JOIN student_tbl s ON c.${complaintStudentFk} = s.S_ID
       LEFT JOIN question_tbl q ON c.Type = 'question' AND c.Content_ID = q.Q_ID
       LEFT JOIN student_tbl sq ON q.Added_By = sq.S_ID
       LEFT JOIN answer_tbl a ON c.Type = 'answer' AND c.Content_ID = a.A_ID
       LEFT JOIN student_tbl sa ON a.Answered_By = sa.S_ID
       LEFT JOIN notes_tbl n ON c.Type = 'notes' AND c.Content_ID = n.N_ID
       LEFT JOIN student_tbl sn ON n.Added_By = sn.S_ID
       LEFT JOIN chat_rooms_tbl cr ON c.Type = 'groups' AND c.Content_ID = cr.Room_ID
       LEFT JOIN student_tbl scr ON cr.Created_By = scr.S_ID
       LEFT JOIN event_tbl e ON c.Type = 'event' AND c.Content_ID = e.E_ID
       LEFT JOIN student_tbl se ON e.Added_By = se.S_ID
       LEFT JOIN student_tbl s_reported ON c.Type = 'user' AND c.Content_ID = s_reported.S_ID
       WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    const query = `
      SELECT 
        c.*,
        s.Name AS Student_Name,
        s.S_ID AS Student_ID,
        ${titleExpression} AS Content_Title,
        ${ownerExpression} AS Content_Owner_Name,
        ${activityExpression} AS Reported_Activity,
        ${complaintContextSelect}
      FROM complaint_tbl c
      LEFT JOIN student_tbl s ON c.${complaintStudentFk} = s.S_ID
      LEFT JOIN question_tbl q ON c.Type = 'question' AND c.Content_ID = q.Q_ID
      LEFT JOIN student_tbl sq ON q.Added_By = sq.S_ID
      LEFT JOIN answer_tbl a ON c.Type = 'answer' AND c.Content_ID = a.A_ID
      LEFT JOIN student_tbl sa ON a.Answered_By = sa.S_ID
      LEFT JOIN notes_tbl n ON c.Type = 'notes' AND c.Content_ID = n.N_ID
      LEFT JOIN student_tbl sn ON n.Added_By = sn.S_ID
      LEFT JOIN chat_rooms_tbl cr ON c.Type = 'groups' AND c.Content_ID = cr.Room_ID
      LEFT JOIN student_tbl scr ON cr.Created_By = scr.S_ID
      LEFT JOIN event_tbl e ON c.Type = 'event' AND c.Content_ID = e.E_ID
      LEFT JOIN student_tbl se ON e.Added_By = se.S_ID
      LEFT JOIN student_tbl s_reported ON c.Type = 'user' AND c.Content_ID = s_reported.S_ID
      ${complaintContextJoins}
      WHERE ${whereClause}
      ORDER BY c.Date DESC
      LIMIT ? OFFSET ?
    `;

    const [complaints] = await db.query(query, [...queryParams, limit, offset]);

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN Is_Active = 1 THEN 1 ELSE 0 END) AS activeCount,
        SUM(CASE WHEN Is_Active = 0 THEN 1 ELSE 0 END) AS inactiveCount
      FROM complaint_tbl
    `);

    const summary = summaryRows[0] || {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
    };

    res.status(200).json({
      success: true,
      data: complaints,
      summary,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Fetch Complaints Error:", err);
    res
      .status(500)
      .json({ status: false, error: "Failed to fetch complaints" });
  }
};

export const getUserComplaints = async (req, res) => {
  try {
    const { id } = req.params; // Student S_ID
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { titleExpression, ownerExpression, activityExpression } =
      buildComplaintContentExpressions();

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM complaint_tbl WHERE Student_ID = ? AND Is_Active = 1`,
      [id],
    );
    const total = countResult[0].total;

    const query = `
      SELECT 
        c.*,
        ${titleExpression} AS Content_Title,
        ${ownerExpression} AS Content_Owner_Name,
        ${activityExpression} AS Reported_Activity,
        ${complaintContextSelect}
      FROM complaint_tbl c
      LEFT JOIN question_tbl q ON c.Type = 'question' AND c.Content_ID = q.Q_ID
      LEFT JOIN student_tbl sq ON q.Added_By = sq.S_ID
      LEFT JOIN answer_tbl a ON c.Type = 'answer' AND c.Content_ID = a.A_ID
      LEFT JOIN student_tbl sa ON a.Answered_By = sa.S_ID
      LEFT JOIN notes_tbl n ON c.Type = 'notes' AND c.Content_ID = n.N_ID
      LEFT JOIN student_tbl sn ON n.Added_By = sn.S_ID
      LEFT JOIN chat_rooms_tbl cr ON c.Type = 'groups' AND c.Content_ID = cr.Room_ID
      LEFT JOIN student_tbl scr ON cr.Created_By = scr.S_ID
      LEFT JOIN event_tbl e ON c.Type = 'event' AND c.Content_ID = e.E_ID
      LEFT JOIN student_tbl se ON e.Added_By = se.S_ID
      LEFT JOIN student_tbl s_reported ON c.Type = 'user' AND c.Content_ID = s_reported.S_ID
      ${complaintContextJoins}
      WHERE c.Student_ID = ? AND c.Is_Active = 1
      ORDER BY c.Date DESC
      LIMIT ? OFFSET ?
    `;

    const [complaints] = await db.query(query, [id, limit, offset]);

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("User Complaints Error:", err);
    res
      .status(500)
      .json({ status: false, error: "Failed to fetch your complaints" });
  }
};

export const addComplaint = async (req, res) => {
  const { Student_ID, Type, Content_ID, Complaint_Text } = req.body;
  console.log(Type);
  const allowedTypes = [
    "question",
    "answer",
    "notes",
    "groups",
    "user",
    "event",
    "other",
  ];

  if (!allowedTypes.includes(Type)) {
    return res.status(400).json({
      error: "Invalid Content_Type",
    });
  }

  try {
    const [result] = await db.query(
      `
      INSERT INTO complaint_tbl
      (Student_ID,Type, Content_ID, Complaint_Text)
      VALUES (?, ?, ?, ?)
      `,
      [Student_ID, Type, Content_ID, Complaint_Text],
    );

    res.status(201).json({
      message: "Complaint submitted successfully",
      complaint_id: result.insertId,
    });
  } catch (err) {
    console.error("Add Complaint Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

export const deleteComplaint = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      error: "Complaint ID is required",
    });
  }

  try {
    const [result] = await db.query(
      `
      UPDATE complaint_tbl
      SET Is_Active = 0
      WHERE Complaint_ID = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Complaint not found",
      });
    }

    res.json({
      message: "Complaint deleted successfully",
    });
  } catch (err) {
    console.error("Delete Complaint Error:", err);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};
