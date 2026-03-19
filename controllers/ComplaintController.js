import db from "../config/db.js";

export const getAllComplaints = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    let conditions = ["c.Is_Active = 1"];
    const queryParams = [];

    if (search) {
      conditions.push("(c.Subject LIKE ? OR c.Description LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(" AND ");

    // Get total count for pagination
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM complaint_tbl c WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    const query = `
      SELECT 
        c.*, 
        s.username AS Student_Name, 
        s.S_ID AS Student_ID
      FROM complaint_tbl c
      LEFT JOIN student_tbl s ON c.Student_Id = s.S_ID
      WHERE ${whereClause}
      ORDER BY c.Date DESC
      LIMIT ? OFFSET ?
    `;

    const [complaints] = await db.query(query, [...queryParams, limit, offset]);

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

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM complaint_tbl WHERE Student_ID = ? AND Is_Active = 1`,
      [id],
    );
    const total = countResult[0].total;

    const query = `
      SELECT 
    c.*,
    -- Extracting the title/text of the reported content
    COALESCE(q.Question, a.Answer, n.Description, cr.Room_Name, e.Description, s_reported.Username) AS Content_Title,
    -- Extracting the Username of the person who created that content
    COALESCE(sq.Username, sa.Username, sn.Username, scr.Username, se.Username, s_reported.Username) AS Content_Owner_Name
FROM complaint_tbl c
-- Joins to get Content Details and their respective Owners
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
