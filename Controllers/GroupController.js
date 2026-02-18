import db from "../config/db.js";

export const addGroup = async(req,res)=>{
    const {Room_Name,Based_On,Created_By} = req.body;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const addGroupQuery = `INSERT INTO chat_rooms_tbl
        (Room_Type,Room_Name,Based_On,Created_By,Created_On,Is_Active) VALUES
        ('Group',?,?,?,NOW(),1)`;

        await connection.query(addGroupQuery,[
            Room_Name,
            Based_On,
            Created_By
        ]);

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Group Created Successfully",
        })
    }catch(err){
        if (connection) connection.rollback();
        console.error("Group creatoin error : ",err);
        return res.status(500).json({ error: "Failed to create event." });
    }finally{
        if (connection) connection.release();
    }
};
