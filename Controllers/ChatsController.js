import db from "../config/db.js";

/**
 * 1️⃣ Send Direct Message (Auto Room Create)
 */
export const sendDirectMessage = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { receiver_id, message_text, message_type = "text" } = req.body;
    const senderId = req.user.Student_ID;

    if (!receiver_id || !message_text) {
      return res.status(400).json({
        message: "Receiver and message required",
      });
    }

    if (receiver_id === senderId) {
      return res.status(400).json({
        message: "You cannot message yourself",
      });
    }

    await connection.beginTransaction();

    // 🔍 Check if direct room exists
    const [existingRoom] = await connection.query(
      `
      SELECT r.Room_ID
      FROM chat_rooms_tbl r
      JOIN chat_room_members_tbl m1 ON r.Room_ID = m1.Room_ID
      JOIN chat_room_members_tbl m2 ON r.Room_ID = m2.Room_ID
      WHERE r.Room_Type = 'direct'
        AND r.Is_Active = 1
        AND m1.Student_ID = ?
        AND m2.Student_ID = ?
        AND m1.Is_Active = 1
        AND m2.Is_Active = 1
      LIMIT 1
      `,
      [senderId, receiver_id]
    );

    let roomId;

    // 🆕 Create room if not exists
    if (existingRoom.length === 0) {
      const [roomResult] = await connection.query(
        `
        INSERT INTO chat_rooms_tbl
        (Room_Type, Room_Name, Created_By)
        VALUES ('direct', NULL, ?)
        `,
        [senderId]
      );

      roomId = roomResult.insertId;

      await connection.query(
        `
        INSERT INTO chat_room_members_tbl
        (Room_ID, Student_ID, Role)
        VALUES
        (?, ?, 'member'),
        (?, ?, 'member')
        `,
        [roomId, senderId, roomId, receiver_id]
      );

    } else {
      roomId = existingRoom[0].Room_ID;
    }

    // 💬 Insert message
    const [messageResult] = await connection.query(
      `
      INSERT INTO chats_tbl
      (Room_ID, Sender_ID, Message_Type, Message_Text)
      VALUES (?, ?, ?, ?)
      `,
      [roomId, senderId, message_type, message_text]
    );

    await connection.commit();

    res.status(201).json({
      message: "Message sent",
      roomId,
      messageId: messageResult.insertId,
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};


/**
 * 2️⃣ Get Messages By Room
 */
export const getMessagesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const [messages] = await db.query(
      `
      SELECT
        Message_ID,
        Room_ID,
        Sender_ID,
        Message_Type,
        Message_Text,
        Sent_On,
        Is_Edited,
        Is_Deleted
      FROM chats_tbl
      WHERE Room_ID = ?
      ORDER BY Sent_On ASC
      `,
      [roomId]
    );

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * 3️⃣ Edit Message
 */
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { new_text } = req.body;
    const userId = req.user.Student_ID;

    await db.query(
      `
      UPDATE chats_tbl
      SET Message_Text = ?, Is_Edited = 1
      WHERE Message_ID = ?
        AND Sender_ID = ?
        AND Is_Deleted = 0
      `,
      [new_text, messageId, userId]
    );

    res.json({ message: "Message updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * 4️⃣ Soft Delete Message
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.Student_ID;

    await db.query(
      `
      UPDATE chats_tbl
      SET Is_Deleted = 1
      WHERE Message_ID = ?
        AND Sender_ID = ?
      `,
      [messageId, userId]
    );

    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * 5️⃣ Mark Messages As Seen
 */
export const markMessagesAsSeen = async (req, res) => {
  try {
    const { roomId } = req.body;
    const memberId = req.user.Student_ID;

    const [messages] = await db.query(
      `
      SELECT Message_ID
      FROM chats_tbl
      WHERE Room_ID = ?
        AND Sender_ID != ?
        AND Is_Deleted = 0
      `,
      [roomId, memberId]
    );

    for (const msg of messages) {
      await db.query(
        `
        INSERT IGNORE INTO chats_seen_tbl
        (Message_ID, Member_ID)
        VALUES (?, ?)
        `,
        [msg.Message_ID, memberId]
      );
    }

    res.json({ message: "Messages marked as seen" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * 6️⃣ Get Chat List (Last Message + Unread Count)
 */
export const getChatList = async (req, res) => {
  try {
    const userId = req.user.Student_ID;

    const [rooms] = await db.query(
      `
      SELECT 
        r.Room_ID,
        r.Room_Type,
        r.Room_Name,
        MAX(c.Sent_On) AS Last_Message_Time,
        (
          SELECT COUNT(*)
          FROM chats_tbl c2
          LEFT JOIN chats_seen_tbl s
            ON c2.Message_ID = s.Message_ID
            AND s.Member_ID = ?
          WHERE c2.Room_ID = r.Room_ID
            AND c2.Sender_ID != ?
            AND s.Message_ID IS NULL
            AND c2.Is_Deleted = 0
        ) AS Unread_Count
      FROM chat_rooms_tbl r
      JOIN chat_room_members_tbl m 
        ON r.Room_ID = m.Room_ID
      LEFT JOIN chats_tbl c 
        ON r.Room_ID = c.Room_ID
      WHERE m.Student_ID = ?
        AND r.Is_Active = 1
        AND m.Is_Active = 1
      GROUP BY r.Room_ID
      ORDER BY Last_Message_Time DESC
      `,
      [userId, userId, userId]
    );

    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};