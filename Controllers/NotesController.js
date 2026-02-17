import db from "../config/db.js"

export const getNotes = async (req,res)=>{
    try{
        const allNotesQuery =  `SELECT n.*,s.username as Author from notes_tbl n 
        LEFT JOIN student_tbl s on n.Added_By = s.S_ID
        WHERE n.Is_Active = 1`

        const [notes] = await db.query(allNotesQuery);

        res.status(201).json({
            status:true,
            notes_count:notes.length,
            notes:notes,
        });
    }catch(err){
        console.error("Fetch Notes Error: ",err);
        res.status(500).json({
            error:"Failed to fetch notes"
        })
    }
}

export const addNotes = async(req,res)=>{
    const {Degree_ID,Subject_ID,Description,Added_By} = req.body;
    const Note_File = req.file ? req.file.path : null;

    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();
        const addNotesQuery= `INSERT INTO notes_tbl (Note_File,Added_By,Added_on,Degree_ID,Subject_ID,Description,Is_Active) values (?,?,NOW(),?,?,?,1)`

        await connection.query(addNotesQuery,[
            Note_File,
            Added_By,
            Degree_ID,
            Subject_ID,
            Description
        ])

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Notes Created Successfully",
        })
    }catch(err){
        if (connection) await connection.rollback();
        console.error("Notes Creation Error : ",err);
        res.status(500).json({
            error: "Failed to create Notes"
        })

    }finally{
        if (connection) connection.release();
    }
};

export const updateNotes = async(req,res)=>{
    const {Degree_ID,Subject_ID,Description,N_ID} = req.body;
    const Note_File = req.file ? req.file.path : null;

    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();
        const updateNotesQuery = `UPDATE notes_tbl SET Note_File = ?, Degree_ID= ?, Subject_ID = ?, Description = ? 
        WHERE N_ID = ?`;

        connection.query(updateNotesQuery,[
            Note_File,
            Degree_ID,
            Subject_ID,
            Description,
            N_ID
        ])

        await connection.commit();
        res.status(201).json({
            status:true,
            message:"Notes Updated Successfully",
        })
    }catch(err){
        if (connection) await connection.rollback();
        console.error("Notes Updation Error : ",err);
        return res.status(500).json({
            error:"Failed to update notes"
        })
    }finally{
        if (connection) connection.release();
    }
};

export const deleteNotes = async(req,res)=>{
    const {id} = req.params;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const deleteNotesQuery = `UPDATE notes_tbl 
        SET Deleted_On = NOW(), is_Active = 0 
        WHERE N_ID = ?`;
        await connection.query(deleteNotesQuery,[id]);

        await connection.commit();

        res.status(201).json({
            status:true,
            message:"Notes Deleted Successfully",
        });
    }catch(err){
        if (connection) await connection.rollback();
        console.error("Notes Deletion Error",err);
        return res.status(500).json({
            error:"Failed to delete notes",
        });
    }finally{
        if(connection) connection.release();
    }
};