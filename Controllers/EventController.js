import db from "../config/db.js";

export const getEvents = async (req, res) => {
  try {
    const allEventsQuery = `SELECT e.*,s.username as Contact_Person from event_tbl e
        LEFT JOIN student_tbl s on e.Added_by = s.S_ID
        WHERE e.Is_Active = 1
        ORDER BY e.Event_Date`;

    const [events] = await db.query(allEventsQuery);

    res.status(200).json({
      success: true,
      event_count: events.length,
      event: events,
    });
  } catch (err) {
    console.error("Fetch Events Error: ", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
};

export const addEvent = async (req,res)=>{
  const {Description, Event_Date, Added_By} = req.body;
  const Poster_File = req.file ? req.file.path : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const createEventQuery = `INSERT INTO event_tbl (Description, Event_Date, Poster_File, Added_By, Added_on, Is_Active) Values (?,?,?,?,NOW(),?)`;

    await connection.query(createEventQuery, [
      Description.trim() || null,
      Event_Date,
      Poster_File,
      Added_By,
      1,
    ]);

    await connection.commit();
    res.status(201).json({
      status: true,
      message: "Event Published Successfully",
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Event Creation Error : ", err);
    return res.status(500).json({ error: "Failed to create event." });
  } finally {
    if (connection) connection.release();
  }
};

export const updateEvents = async(req,res)=>{
  const {Description, Event_Date, E_ID} = req.body;
  const Poster_File = req.file ? req.file.path : null;

  let connection;
  try{

    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const updateEventQuery=`UPDATE event_tbl SET Poster_File = ?, Description = ?, Event_Date = ? Where E_ID = ?`
    await connection.query(updateEventQuery,[Poster_File,Description,Event_Date,E_ID]);
    await connection.commit();
    res.status(201).json({
      status:true,
      message:"Event updates successfully",
    })

  }catch(err){
    if(connection) await connection.rollback();
    console.error("Event updation Error :", err);
    return res.status(500).json({error:"Failed to update event."});
  }finally{
    if (connection) connection.release();
  }
};

export const deleteEvent = async(req,res)=>{
    const {id} = req.params;
    let connection;
    try{
        connection = await db.getConnection();
        await connection.beginTransaction();

        const deleteEventQuery = `UPDATE event_tbl 
        SET Deleted_On = NOW(), is_Active = 0 
        WHERE E_ID = ?`;
        await connection.query(deleteEventQuery,[id]);

        await connection.commit();

        res.status(201).json({
            status:true,
            message:"Event Deleted Successfully",
        });
    }catch(err){
        if (connection) await connection.rollback();
        console.error("Event Deletion Error",err);
        return res.status(500).json({
            error:"Failed to delete events",
        });
    }finally{
        if(connection) connection.release();
    }
};
