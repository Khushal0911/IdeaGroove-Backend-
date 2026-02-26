import db from "../config/db.js";

export const getGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const filter = req.query.filter || "all";

    let conditions = ["r.Is_Active = 1", "r.Room_Type = 'group'"];
    const queryParams = [];

    if (search) {
      conditions.push(
        "(r.Room_Name LIKE ? OR r.Description LIKE ? OR h.Hobby_Name LIKE ?)",
      );
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(" AND ");
    const orderClause =
      filter === "oldest_to_newest"
        ? "ORDER BY r.Created_On ASC"
        : "ORDER BY r.Created_On DESC";

    /* ---------- COUNT ---------- */
    const [countResult] = await db.query(
      `SELECT COUNT(DISTINCT r.Room_ID) as total
       FROM chat_rooms_tbl r
       LEFT JOIN hobbies_tbl h ON r.Based_On = h.Hobby_ID
       WHERE ${whereClause}`,
      queryParams,
    );

    const total = countResult[0].total;

    /* ---------- MAIN QUERY ---------- */
    const query = `
      SELECT 
        r.Room_ID,
        r.Room_Name,
        r.Room_Type,
        r.Created_On,
        r.Created_By,
        r.Is_Active,
        r.Description,
        r.Based_On,
        s.username AS Creator_Name,
        s.S_ID AS Creator_ID,
        h.Hobby_Name,
        COUNT(DISTINCT m.Student_ID) AS Member_Count,

        (
          SELECT COALESCE(
            JSON_ARRAYAGG(
              JSON_OBJECT(
                'role', rm.Role,
                'username', s2.username,
                'name', s2.name,
                'Profile_Pic', s2.Profile_Pic,
                'Student_ID', s2.S_ID
              )
            ),
            JSON_ARRAY()
          )
          FROM chat_room_members_tbl rm
          LEFT JOIN student_tbl s2 ON rm.Student_ID = s2.S_ID
          WHERE rm.Room_ID = r.Room_ID AND rm.Is_Active = 1
        ) AS Members

      FROM chat_rooms_tbl r
      LEFT JOIN student_tbl s ON r.Created_By = s.S_ID
      LEFT JOIN hobbies_tbl h ON r.Based_On = h.Hobby_ID
      LEFT JOIN chat_room_members_tbl m 
        ON r.Room_ID = m.Room_ID AND m.Is_Active = 1

      WHERE ${whereClause}

      GROUP BY 
        r.Room_ID, r.Room_Name, r.Room_Type, r.Created_On, r.Created_By,
        r.Is_Active, r.Description, r.Based_On, s.username, s.S_ID, h.Hobby_Name

      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const [rooms] = await db.query(query, [...queryParams, limit, offset]);

    const formattedRooms = rooms.map((room) => ({
      ...room,
      Members:
        typeof room.Members === "string"
          ? JSON.parse(room.Members)
          : room.Members,
    }));

    res.status(200).json({
      status: true,
      data: formattedRooms,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Fetch Groups Error:", err);
    res.status(500).json({ status: false, error: "Failed to fetch groups" });
  }
};

export const getUserGroups = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM chat_room_members_tbl 
      WHERE Student_ID = ? AND Is_Active = 1`;

    const [countResult] = await db.query(countQuery, [userId]);
    const total = countResult[0].total;

    const query = `
      SELECT 
        r.Room_ID, 
        r.Room_Name, 
        r.Based_On, 
        r.Description, 
        m.Role, 
        m.Joined_on
      FROM chat_rooms_tbl r
      INNER JOIN chat_room_members_tbl m ON r.Room_ID = m.Room_ID
      WHERE m.Student_ID = ? 
        AND m.Is_Active = 1 
        AND r.Is_Active = 1
      ORDER BY m.Joined_on DESC
      LIMIT ? OFFSET ?
    `;

    const [myGroups] = await db.query(query, [userId, limit, offset]);

    if (myGroups.length === 0) {
      return res.status(200).json({
        status: true,
        message: "You haven't joined any groups yet.",
        data: [],
        total: 0,
      });
    }

    res.status(200).json({
      status: true,
      data: myGroups,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("User Gallery Error:", err);
    res
      .status(500)
      .json({ status: false, error: "Failed to fetch your groups" });
  }
};

export const addGroup = async (req, res) => {
  const { Room_Name, Based_On, Description, Created_By } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const addGroupQuery = `INSERT INTO chat_rooms_tbl
      (Room_Type, Room_Name, Based_On, Created_By, Created_On, Is_Active, Description) 
      VALUES ('Group', ?, ?, ?, NOW(), 1, ?)`;

    const [addResult] = await connection.query(addGroupQuery, [
      Room_Name,
      Based_On,
      Created_By,
      Description,
    ]);

    if (addResult.affectedRows > 0) {
      const newRoomId = addResult.insertId;

      const addAdminQuery = `INSERT INTO chat_room_members_tbl 
        (Room_ID, Student_ID, Role, Joined_on, Is_Active)
        VALUES (?, ?, 'admin', NOW(), 1)`;

      const [adminResult] = await connection.query(addAdminQuery, [
        newRoomId,
        Created_By,
      ]);

      if (adminResult.affectedRows > 0) {
        await connection.commit();
        res
          .status(201)
          .json({ status: true, message: "Group Created Successfully" });
      } else {
        await connection.rollback();
        res.status(400).json({
          status: false,
          message: "Group Created but error in admin entry",
        });
      }
    } else {
      await connection.rollback();
      res
        .status(400)
        .json({ status: false, message: "Group Created unsuccessfully" });
    }
  } catch (err) {
    if (connection) connection.rollback();
    console.error("Group creation error:", err);
    return res.status(500).json({ error: "Failed to create group." });
  } finally {
    if (connection) connection.release();
  }
};

export const updateGroup = async (req, res) => {
  const { Room_Name, Based_On, Room_ID, Description } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const updateGroupQuery = `UPDATE chat_rooms_tbl
      SET Room_Name = ?, Based_On = ?, Description = ?
      WHERE Room_ID = ?`;

    const [updateResult] = await connection.query(updateGroupQuery, [
      Room_Name,
      Based_On,
      Description,
      Room_ID,
    ]);

    if (updateResult.affectedRows > 0) {
      await connection.commit();
      res
        .status(201)
        .json({ status: true, message: "Group Updated successfully" });
    } else {
      await connection.rollback();
      res
        .status(400)
        .json({ status: false, message: "Group Updation unsuccessful" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Unable to update the group");
    res.status(500).json({ error: "Failed to update group" });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteGroup = async (req, res) => {
  const { Room_ID } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const deleteGroupQuery = `UPDATE chat_rooms_tbl
      SET Is_Active = 0, Deleted_On = NOW()
      WHERE Room_ID = ?`;

    const [deleteResult] = await connection.query(deleteGroupQuery, [Room_ID]);

    if (deleteResult.affectedRows > 0) {
      await connection.commit();
      res
        .status(201)
        .json({ status: true, message: "Group Deleted Successfully" });
    } else {
      await connection.rollback();
      res
        .status(400)
        .json({ status: false, message: "Group Deletion Unsuccessful" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Unable to delete group");
    res.status(500).json({ error: "Failed to delete group" });
  } finally {
    if (connection) connection.release();
  }
};

export const joinGroup = async (req, res) => {
  const { Room_ID, Student_ID } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT * FROM chat_room_members_tbl WHERE Room_ID = ? AND Student_ID = ?`,
      [Room_ID, Student_ID],
    );

    let finalStatus = "";
    let joinResult;

    if (existing.length > 0) {
      if (existing[0].Is_Active === 1) {
        finalStatus = "Already a member";
      } else {
        [joinResult] = await connection.query(
          `UPDATE chat_room_members_tbl SET Is_Active = 1, Joined_On = NOW(), Left_On = NULL WHERE Room_ID = ? AND Student_ID = ?`,
          [Room_ID, Student_ID],
        );
        finalStatus = "Re-joined group successfully";
      }
    } else {
      [joinResult] = await connection.query(
        `INSERT INTO chat_room_members_tbl (Room_ID, Student_ID, Role, Joined_on, Is_Active) VALUES (?, ?, 'member', NOW(), 1)`,
        [Room_ID, Student_ID],
      );
      finalStatus = "Joined group successfully";
    }

    if (joinResult.affectedRows > 0) {
      await connection.commit();
      res.status(201).json({ status: true, message: finalStatus });
    } else {
      await connection.rollback();
      res.status(400).json({ status: true, message: "Error in joining group" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: "Failed to join group" });
  } finally {
    if (connection) connection.release();
  }
};

export const leaveGroup = async (req, res) => {
  const { Room_ID, Student_ID } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [memberInfo] = await connection.query(
      `SELECT Role, Is_Active FROM chat_room_members_tbl WHERE Student_ID = ? AND Room_ID = ?`,
      [Student_ID, Room_ID],
    );

    if (!memberInfo.length || memberInfo[0].Is_Active === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: false,
        message: "User is not an active member of this group",
      });
    }

    const userRole = memberInfo[0].Role;

    if (userRole === "admin") {
      const [successors] = await connection.query(
        `SELECT Student_ID FROM chat_room_members_tbl 
         WHERE Room_ID = ? AND Is_Active = 1 AND Student_ID != ? 
         ORDER BY Joined_on ASC LIMIT 1`,
        [Room_ID, Student_ID],
      );

      if (successors.length > 0) {
        const nextAdminId = successors[0].Student_ID;
        await connection.query(
          `UPDATE chat_room_members_tbl SET Role = 'admin' WHERE Student_ID = ? AND Room_ID = ?`,
          [nextAdminId, Room_ID],
        );
      } else {
        await connection.query(
          `UPDATE chat_rooms_tbl SET Is_Active = 0, Deleted_On = NOW() WHERE Room_ID = ?`,
          [Room_ID],
        );
      }
    }

    const [leaveResult] = await connection.query(
      `UPDATE chat_room_members_tbl SET Is_Active = 0, Left_On = NOW() WHERE Student_ID = ? AND Room_ID = ?`,
      [Student_ID, Room_ID],
    );

    if (leaveResult.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message:
          userRole === "admin"
            ? "Left group and promoted new admin"
            : "Left group successfully",
      });
    } else {
      await connection.rollback();
      res.status(400).json({ status: false, message: "Failed to leave group" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Leave Group Error:", err);
    res.status(500).json({ status: false, error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

export const viewMembers = async (req, res) => {
  const { Room_ID } = req.params;
  try {
    const membersQuery = `
      SELECT rm.role as role, s.username, s.name, s.Profile_Pic, r.Room_ID 
      FROM chat_room_members_tbl rm
      LEFT JOIN chat_rooms_tbl r ON r.Room_ID = rm.Room_ID
      LEFT JOIN student_tbl s ON s.S_ID = rm.Student_ID
      WHERE r.Room_ID = ?`;

    const [membersDetails] = await db.query(membersQuery, [Room_ID]);

    res.status(201).json({ status: true, membersDetails });
  } catch (err) {
    console.error("Unable to load members");
    res.status(500).json({ error: "Unable to fetch members details" });
  }
};
