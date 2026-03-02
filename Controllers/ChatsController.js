import db from "../config/db.js";
import { encryptMessage, decryptMessage } from "../utils/chatEncryption.js";

/**
 * POST /api/chats/create-room
 */
export const createChatRoom = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { receiver_id, room_type = "direct" } = req.body;
    const senderId = req.user.Student_ID;

    await connection.beginTransaction();

    if (room_type === "direct") {
      if (!receiver_id) {
        return res
          .status(400)
          .json({ message: "receiver_id is required for direct chat" });
      }

      if (receiver_id === senderId) {
        return res
          .status(400)
          .json({ message: "You cannot chat with yourself" });
      }

      const [existingRoom] = await connection.query(
        `SELECT r.Room_ID
         FROM chat_rooms_tbl r
         JOIN chat_room_members_tbl m1 ON r.Room_ID = m1.Room_ID
         JOIN chat_room_members_tbl m2 ON r.Room_ID = m2.Room_ID
         WHERE r.Room_Type = 'direct'
           AND r.Is_Active = 1
           AND m1.Student_ID = ?
           AND m2.Student_ID = ?
           AND m1.Is_Active = 1
           AND m2.Is_Active = 1
         LIMIT 1`,
        [senderId, receiver_id],
      );

      if (existingRoom.length > 0) {
        await connection.commit();
        return res.status(200).json({
          message: "Room already exists",
          roomId: existingRoom[0].Room_ID,
        });
      }

      const [roomResult] = await connection.query(
        `INSERT INTO chat_rooms_tbl (Room_Type, Room_Name, Created_By)
         VALUES ('direct', NULL, ?)`,
        [senderId],
      );

      const roomId = roomResult.insertId;

      await connection.query(
        `INSERT INTO chat_room_members_tbl (Room_ID, Student_ID, Role)
         VALUES (?, ?, 'member'), (?, ?, 'member')`,
        [roomId, senderId, roomId, receiver_id],
      );

      await connection.commit();
      return res.status(201).json({ message: "Direct room created", roomId });
    }

    await connection.commit();
    return res.status(400).json({ message: "Invalid room_type" });
  } catch (error) {
    await connection.rollback();
    console.error("createChatRoom error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/chats/my-rooms
 */
export const getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user.Student_ID;

    const [rooms] = await db.query(
      `SELECT
        r.Room_ID,
        r.Room_Type,
        r.Room_Name,
        r.Description,
        r.Based_On,
        r.Created_By,
        r.Created_On,
        (
          SELECT c.Message_Text
          FROM chats_tbl c
          WHERE c.Room_ID = r.Room_ID AND c.Is_Deleted = 0
          ORDER BY c.Sent_On DESC
          LIMIT 1
        ) AS Last_Message,
        (
          SELECT c.Encryption_IV
          FROM chats_tbl c
          WHERE c.Room_ID = r.Room_ID AND c.Is_Deleted = 0
          ORDER BY c.Sent_On DESC
          LIMIT 1
        ) AS Last_IV,
        (
          SELECT c.Sent_On
          FROM chats_tbl c
          WHERE c.Room_ID = r.Room_ID AND c.Is_Deleted = 0
          ORDER BY c.Sent_On DESC
          LIMIT 1
        ) AS Last_Message_At,
        (
          SELECT COUNT(*)
          FROM chats_tbl c2
          LEFT JOIN chats_seen_tbl s 
            ON c2.Message_ID = s.Message_ID AND s.Member_ID = ?
          WHERE c2.Room_ID = r.Room_ID
            AND c2.Sender_ID != ?
            AND s.Message_ID IS NULL
            AND c2.Is_Deleted = 0
        ) AS Unread_Count,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'Student_ID', s2.S_ID,
              'username', s2.username,
              'name', s2.name,
              'Profile_Pic', s2.Profile_Pic,
              'Role', m2.Role
            )
          )
          FROM chat_room_members_tbl m2
          JOIN student_tbl s2 ON m2.Student_ID = s2.S_ID
          WHERE m2.Room_ID = r.Room_ID AND m2.Is_Active = 1
        ) AS Members
      FROM chat_rooms_tbl r
      JOIN chat_room_members_tbl m ON r.Room_ID = m.Room_ID
      WHERE m.Student_ID = ?
        AND r.Is_Active = 1
        AND m.Is_Active = 1
      GROUP BY r.Room_ID
      ORDER BY Last_Message_At DESC`,
      [userId, userId, userId],
    );

    const formatted = rooms.map((room) => {
      if (room.Last_Message && room.Last_IV) {
        try {
          room.Last_Message = decryptMessage(
            room.Last_Message,
            room.Last_IV
          );
        } catch (err) {
          console.error("Preview decrypt failed:", err);
        }
      }

      return {
        ...room,
        Members:
          typeof room.Members === "string"
            ? JSON.parse(room.Members)
            : room.Members || [],
      };
    });

    res.json({ status: true, data: formatted });
  } catch (error) {
    console.error("getUserChatRooms error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/chats/send
 */
export const sendMessage = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { room_id, message_text, message_type = "text" } = req.body;
    const senderId = req.user.Student_ID;

    if (!room_id || !message_text) {
      return res
        .status(400)
        .json({ message: "room_id and message_text are required" });
    }

    await connection.beginTransaction();

    const [membership] = await connection.query(
      `SELECT Member_ID FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [room_id, senderId],
    );

    if (membership.length === 0) {
      await connection.rollback();
      return res
        .status(403)
        .json({ message: "You are not a member of this room" });
    }

    // 🔐 Encrypt message
    const { encryptedData, iv } = encryptMessage(message_text);

    const [result] = await connection.query(
      `INSERT INTO chats_tbl 
       (Room_ID, Sender_ID, Message_Type, Message_Text, Encryption_IV)
       VALUES (?, ?, ?, ?, ?)`,
      [room_id, senderId, message_type, encryptedData, iv],
    );

    await connection.commit();

    res.status(201).json({
      message: "Message sent",
      messageId: result.insertId,
      roomId: room_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error("sendMessage error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/chats/messages/:roomId
 */
export const getMessagesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user.Student_ID;

    const [membership] = await db.query(
      `SELECT Member_ID FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [roomId, userId],
    );

    if (membership.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const [messages] = await db.query(
      `SELECT
         c.Message_ID,
         c.Room_ID,
         c.Sender_ID,
         s.username AS Sender_Username,
         s.Profile_Pic AS Sender_Profile_Pic,
         c.Message_Type,
         c.Message_Text,
         c.Encryption_IV,
         c.Sent_On,
         c.Is_Edited,
         c.Is_Deleted,
         EXISTS(
           SELECT 1 FROM chats_seen_tbl cs
           WHERE cs.Message_ID = c.Message_ID 
             AND cs.Member_ID != c.Sender_ID
           LIMIT 1
         ) AS Is_Seen
       FROM chats_tbl c
       JOIN student_tbl s ON c.Sender_ID = s.S_ID
       WHERE c.Room_ID = ?
       ORDER BY c.Sent_On ASC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset],
    );

    const decryptedMessages = messages.map((msg) => {
      if (msg.Message_Text && msg.Encryption_IV) {
        try {
          return {
            ...msg,
            Message_Text: decryptMessage(
              msg.Message_Text,
              msg.Encryption_IV
            ),
          };
        } catch (err) {
          console.error("Decryption failed:", err);
          return msg;
        }
      }
      return msg;
    });

    res.json({ status: true, data: decryptedMessages });
  } catch (error) {
    console.error("getMessagesByRoom error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/chats/delete/:messageId
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.Student_ID;

    const [result] = await db.query(
      `UPDATE chats_tbl SET Is_Deleted = 1
       WHERE Message_ID = ? AND Sender_ID = ?`,
      [messageId, userId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Message not found or not yours" });
    }

    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error("deleteMessage error:", error);
    res.status(500).json({ message: "Server error" });
  }
};