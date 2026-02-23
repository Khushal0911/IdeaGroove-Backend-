import db from "../config/db.js";

export const getQnA = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM question_tbl WHERE Is_Active = 1`,
    );
    const total = countResult[0].total;

    const allQnAQuery = `
    SELECT 
        q.Q_ID,
        q.Question,
        qs.username AS Question_Author,
        q.Added_On,
        q.Is_Active,
        d.Degree_Name,
        d.Degree_ID,
        s.Subject_Name,
        s.Subject_ID,

        COUNT(a.A_ID) AS Total_Answers,

        JSON_ARRAYAGG(
            JSON_OBJECT(
                'A_ID', a.A_ID,
                'Answer', a.Answer,
                'Answer_Author', ans.username,
                'Answered_On', a.Answered_On
            )
        ) AS Answers

    FROM question_tbl q

    LEFT JOIN student_tbl qs 
        ON q.Added_By = qs.S_ID

    LEFT JOIN degree_tbl d 
        ON q.Degree_ID = d.Degree_ID

    LEFT JOIN subject_tbl s 
        ON q.Subject_ID = s.Subject_ID

    LEFT JOIN answer_tbl a 
        ON q.Q_ID = a.Q_ID 
        AND a.Is_Active = 1

    LEFT JOIN student_tbl ans 
        ON a.Answered_By = ans.S_ID

    WHERE q.Is_Active = 1

    GROUP BY 
        q.Q_ID,
        q.Question,
        qs.username,
        q.Added_On,
        d.Degree_Name,
        d.Degree_ID,
        s.Subject_Name,
        s.Subject_ID

    ORDER BY q.Added_On DESC
    LIMIT ? OFFSET ?
`;
    const [QnAData] = await db.query(allQnAQuery, [limit, offset]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      QnA: QnAData,
    });
  } catch (err) {
    console.error("Fetch QnA Error", err);
    res.status(500).json({ status: false, error: "Failed to fetch QnA" });
  }
};

export const getUserQuestions = async (req, res) => {
  try {
    const userId = req.params.id;
    const [questions] = await db.query(
      `SELECT * FROM question_tbl WHERE Added_By = ? AND Is_Active = 1 ORDER BY Added_On DESC`,
      [userId],
    );

    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      error: "Failed to fetch user questions",
    });
  }
};

export const addQuestion = async (req, res) => {
  console.log(req.body);
  const { Question, Degree_ID, Subject_ID, Added_By } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const addQuestionQuery = `INSERT INTO question_tbl (Question,Added_By,Added_On,Degree_ID,Subject_ID,Is_Active)
        VALUES (?,?,NOW(),?,?,1)`;

    const [result] = await connection.query(addQuestionQuery, [
      Question,
      Added_By,
      Degree_ID,
      Subject_ID,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res.status(201).json({
        status: true,
        message: "Question Added Successfully",
      });
    } else {
      await connection.rollback();
      res.status(400).json({
        status: false,
        message: "Failed to add question",
      });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Question Creation Error", err);
    res.status(500).json({
      error: "Failed to add Question",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const updateQuestion = async (req, res) => {
  const { Question, Degree_ID, Subject_ID, Q_ID } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const updateQuestionQuery = `UPDATE question_tbl
        SET Question = ?, Degree_ID=?, Subject_ID=?
        WHERE Q_ID=?`;

    const [result] = await connection.query(updateQuestionQuery, [
      Question,
      Degree_ID,
      Subject_ID,
      Q_ID,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Question Updated Successfully" });
    } else {
      await connection.rollback();
      res.status(404).json({
        status: false,
        message: "Question not found or no changes made",
      });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Question Updation Error", err);
    res.status(500).json({
      error: "Failed to update question",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteQuestion = async (req, res) => {
  const { Q_ID } = req.params;
  console.log(Q_ID);
  let connection;
  try {
    connection = await db.getConnection();
    await connection.commit();
    const deleteQuestionQuery = `UPDATE question_tbl
        SET Is_Active = 0, Deleted_on = NOW() 
        WHERE Q_ID=?`;

    const [result] = await connection.query(deleteQuestionQuery, [Q_ID]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Question Deleted Successfully" });
    } else {
      await connection.rollback();
      res.status(404).json({ status: false, message: "Question not found" });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Error in Deletion of question", err);
    res.status(500).json({
      error: "Failed to delete question",
    });
  } finally {
    if (connection) connection.release();
  }
};

//CRUD for question
export const addAnswer = async (req, res) => {
  const { Answer, Q_ID, Answered_By } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const addAnswerQuery = `INSERT INTO answer_tbl (Answer,Q_ID,Answered_By,Answered_On,Is_Active)
        VALUES(?,?,?,NOW(),1)`;

    const [result] = await connection.query(addAnswerQuery, [
      Answer,
      Q_ID,
      Answered_By,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(201)
        .json({ status: true, message: "Answer posted successfully" });
    } else {
      await connection.rollback();
      res.status(400).json({ status: false, message: "Failed to post answer" });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Failed to add Answer", err);
    res.status(500).json({
      error: "Failed to Insert answer",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const updateAnswer = async (req, res) => {
  const { Answer, A_ID } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const updateQuestionQuery = `UPDATE answer_tbl
        SET Answer = ?
        WHERE A_ID=?`;

    const [result] = await connection.query(updateQuestionQuery, [
      Answer,
      A_ID,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Answer Updated Successfully" });
    } else {
      await connection.rollback();
      res.status(404).json({ status: false, message: "Answer not found" });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Answer Updation Error", err);
    res.status(500).json({
      error: "Failed to update Answer",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteAnswer = async (req, res) => {
  const { A_ID } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const deleteAnswerQuery = `UPDATE answer_tbl
        SET Is_Active = 0
        WHERE A_ID=?`;

    const [result] = await connection.query(deleteAnswerQuery, [A_ID]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Answer Deleted Successfully" });
    } else {
      await connection.rollback();
      res.status(404).json({ status: false, message: "Answer not found" });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Answer Deletion Error : ", err);
    res.status(500).json({
      error: "Failed to delete answer",
    });
  } finally {
    if (connection) connection.release();
  }
};
