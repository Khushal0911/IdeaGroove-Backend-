import db from "../config/db.js";

export const getQnA = async(req,res)=>{
    try{
        const allQnAQuery = `SELECT 
    q.Q_ID, 
    q.Question, 
    qs.username AS Question_Author, 
    q.Added_On,
    a.A_ID, 
    a.Answer, 
    ans.username AS Answer_Author, 
    a.Answered_On,
    (SELECT COUNT(*) FROM answer_tbl WHERE Q_ID = q.Q_ID AND Is_Active = 1) AS Total_Answers
    FROM question_tbl q
    LEFT JOIN student_tbl qs ON q.Added_By = qs.S_ID
    LEFT JOIN answer_tbl a ON q.Q_ID = a.Q_ID AND a.Is_Active = 1
    LEFT JOIN student_tbl ans ON a.Answered_By = ans.S_ID
    WHERE q.Is_Active = 1`;

        const [QnAData] = await db.query(allQnAQuery);

        res.status(200).json({
            success: true,
            QnA:QnAData,
        });

    }catch(err){
        console.error("Fetch QnA Error",err);
        res.status(500).json({
            error:"Failed to fetch error",
        })
    }
};

export const addQuestion = async(req,res)=>{
    console.log(req.body);
    const {Question,Degree_ID,Subject_ID,Added_By} = req.body;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const addQuestionQuery = `INSERT INTO question_tbl (Question,Added_By,Added_On,Degree_ID,Subject_ID,Is_Active)
        VALUES (?,?,NOW(),?,?,1)`;

        await connection.query(addQuestionQuery,[
            Question,
            Added_By,
            Degree_ID,
            Subject_ID
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Question Added Successfully",
        });
    }catch(err){
        if(connection) connection.rollback();
        console.error("Question Creation Error",err);
        res.status(500).json({
            error:"Failed to add Question"
        });
    }finally{
        if(connection) connection.release();
    }
};

export const updateQuestion = async(req,res)=>{
    const {Question,Degree_ID,Subject_ID,Q_ID} = req.body;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const updateQuestionQuery= `UPDATE question_tbl
        SET Question = ?, Degree_ID=?, Subject_ID=?
        WHERE Q_ID=?`;

        await connection.query(updateQuestionQuery,[
            Question,
            Degree_ID,
            Subject_ID,
            Q_ID
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Question Updated Successfully",
        });

    }catch(err){
        if(connection) connection.rollback();
        console.error("Question Updation Error",err);
        res.status(500).json({
            error:"Failed to update question",
        })
    }finally{
        if (connection) connection.release();
    }
};

export const deleteQuestion = async(req,res)=>{
    const {Q_ID} = req.params;
    console.log(Q_ID);
    let connection;
    try{
        connection = await db.getConnection();
        await connection.commit();
        const deleteQuestionQuery = `UPDATE question_tbl
        SET Is_Active = 0, Deleted_on = NOW() 
        WHERE Q_ID=?`;

        await connection.query(deleteQuestionQuery,[
            Q_ID
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Question Deleted Successully",
        })

    }catch(err){
        if(connection) connection.rollback();
        console.error("Error in Deletion of question",err);
        res.status(500).json({
            error:"Failed to delete question",
        });
    }finally{
        if(connection) connection.release();
    }
}


//CRUD for question
export const addAnswer = async(req,res)=>{
    const {Answer,Q_ID,Answered_By} = req.body;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const addAnswerQuery = `INSERT INTO answer_tbl (Answer,Q_ID,Answered_By,Answered_On,Is_Active)
        VALUES(?,?,?,NOW(),1)`;

        await connection.query(addAnswerQuery,[
            Answer,
            Q_ID,
            Answered_By
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
        });

    }catch(err){
        if(connection) connection.rollback();
        console.error("Failed to add Answer",err);
        res.status(500).json({
            error:"Failed to Insert answer",
        });
    }finally{
        if(connection) connection.release();
    }
};

export const updateAnswer = async(req,res)=>{
    const {Answer,A_ID} = req.body;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const updateQuestionQuery= `UPDATE answer_tbl
        SET Answer = ?
        WHERE A_ID=?`;

        await connection.query(updateQuestionQuery,[
            Answer,
            A_ID
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Answer Updated Successfully",
        });

    }catch(err){
        if(connection) connection.rollback();
        console.error("Answer Updation Error",err);
        res.status(500).json({
            error:"Failed to update Answer",
        })
    }finally{
        if (connection) connection.release();
    }
    
}

export const deleteAnswer = async(req,res)=>{
    const {A_ID} =req.params;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const deleteAnswerQuery = `UPDATE answer_tbl
        SET Is_Active = 0
        WHERE A_ID=?`;

        await connection.query(deleteAnswerQuery,[
            A_ID
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Answer Deleted Sucessfully",
        });
    }catch(err){
        if(connection) connection.rollback();
        console.error("Answer Deletion Error : ",err);
        res.status(500).json({
            error:"Failed to delete answer",
        })
    }finally{
        if(connection) connection.release();
    }
}