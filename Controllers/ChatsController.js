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
        (
          SELECT Message_Text FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Message,
        (
          SELECT Message_Type FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Type,
        (
          SELECT Encryption_IV FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_IV,
        (
          SELECT Sent_On FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Message_At,
        (
          SELECT Sender_ID FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Sender_ID,
        (
          SELECT Is_Deleted FROM chats_tbl
          WHERE Room_ID = r.Room_ID
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Is_Deleted,
        (
          SELECT s3.name
          FROM chats_tbl c3
          JOIN student_tbl s3 ON c3.Sender_ID = s3.S_ID
          WHERE c3.Room_ID = r.Room_ID
          ORDER BY c3.Sent_On DESC LIMIT 1
        ) AS Last_Sender_Name,
        (
          SELECT s3.username
          FROM chats_tbl c3
          JOIN student_tbl s3 ON c3.Sender_ID = s3.S_ID
          WHERE c3.Room_ID = r.Room_ID
          ORDER BY c3.Sent_On DESC LIMIT 1
        ) AS Last_Sender_Username,
        (
          SELECT EXISTS(
            SELECT 1
            FROM chats_seen_tbl cs4
            JOIN chat_room_members_tbl m4 ON cs4.Member_ID = m4.Member_ID
            WHERE cs4.Message_ID = (
              SELECT c4.Message_ID
              FROM chats_tbl c4
              WHERE c4.Room_ID = r.Room_ID
              ORDER BY c4.Sent_On DESC LIMIT 1
            )
              AND m4.Room_ID = r.Room_ID
              AND m4.Is_Active = 1
              AND m4.Student_ID != (
                SELECT c5.Sender_ID
                FROM chats_tbl c5
                WHERE c5.Room_ID = r.Room_ID
                ORDER BY c5.Sent_On DESC LIMIT 1
              )
            LIMIT 1
          )
        ) AS Last_Is_Seen,
        /* ✅ FIX: Unread_Count was missing — now properly counted per member */
        (
          SELECT COUNT(*)
          FROM chats_tbl c2
          LEFT JOIN chats_seen_tbl cs2
            ON c2.Message_ID = cs2.Message_ID
            AND cs2.Member_ID = m.Member_ID
          WHERE c2.Room_ID = r.Room_ID
            AND c2.Sender_ID != m.Student_ID
            AND c2.Is_Deleted = 0
            AND cs2.Seen_ID IS NULL
        ) AS Unread_Count,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'Student_ID', s2.S_ID,
              'username', s2.username,
              'name', s2.name,
              'Profile_Pic', s2.Profile_Pic
            )
          )
          FROM chat_room_members_tbl m2
          JOIN student_tbl s2 ON m2.Student_ID = s2.S_ID
          WHERE m2.Room_ID = r.Room_ID AND m2.Is_Active = 1
        ) AS Members
      FROM chat_rooms_tbl r
      JOIN (
        SELECT Room_ID, Student_ID, MAX(Member_ID) AS Member_ID
        FROM chat_room_members_tbl
        WHERE Student_ID = ? AND Is_Active = 1
        GROUP BY Room_ID, Student_ID
      ) m ON r.Room_ID = m.Room_ID
      WHERE r.Is_Active = 1
      ORDER BY Last_Message_At DESC`,
      [userId],
    );

    const formatted = rooms.map((room) => {
      if (room.Last_Is_Deleted) {
        room.Last_Message = "Message deleted";
        room.Raw_Path = null;
      } else if (room.Last_Message && room.Last_IV) {
        try {
          const decrypted = decryptMessage(room.Last_Message, room.Last_IV);
          room.Last_Message =
            room.Last_Type === "text" ? decrypted : `Sent a ${room.Last_Type}`;
          room.Raw_Path = room.Last_Type !== "text" ? decrypted : null;
        } catch (err) {
          console.error("Decrypt failed:", err);
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
      return res.status(400).json({ message: "Content is required" });
    }

    await connection.beginTransaction();

    const [membership] = await connection.query(
      `SELECT Member_ID FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [room_id, senderId],
    );

    if (membership.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: "Access denied" });
    }

    const { encryptedData, iv } = encryptMessage(message_text);
    const isFile = message_type !== "text";

    const [result] = await connection.query(
      `INSERT INTO chats_tbl
        (Room_ID, Sender_ID, Message_Type, Message_Text, File_Path, Encryption_IV)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        room_id,
        senderId,
        message_type,
        isFile ? null : encryptedData,
        isFile ? encryptedData : null,
        iv,
      ],
    );

    await connection.commit();
    res
      .status(201)
      .json({ message: "Message sent", messageId: result.insertId });
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
 *
 * ✅ FIX: Removed `AND c.Is_Deleted = 0` filter so deleted messages are
 * returned to both sender and receiver. ChatBody renders the
 * "Message deleted" placeholder when Is_Deleted = 1.
 */
export const getMessagesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
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
      `SELECT c.*, s.username AS Sender_Username, s.name AS Sender_Name, s.Profile_Pic AS Sender_Profile_Pic
       FROM chats_tbl c
       JOIN student_tbl s ON c.Sender_ID = s.S_ID
       WHERE c.Room_ID = ?
       ORDER BY c.Sent_On ASC`,
      [roomId],
    );

    const decryptedMessages = messages.map((msg) => {
      // Deleted messages: nothing to decrypt, return as-is
      if (msg.Is_Deleted) return msg;

      const encryptedContent =
        msg.Message_Type === "text" ? msg.Message_Text : msg.File_Path;

      if (encryptedContent && msg.Encryption_IV) {
        try {
          const decrypted = decryptMessage(encryptedContent, msg.Encryption_IV);
          return {
            ...msg,
            Message_Text:
              msg.Message_Type === "text" ? decrypted : msg.Message_Text,
            File_Path: msg.Message_Type !== "text" ? decrypted : null,
          };
        } catch (err) {
          console.error("Decryption failed for Message ID:", msg.Message_ID);
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

/**
 * POST /api/chats/mark-seen
 */
export const markMessagesSeen = async (req, res) => {
  try {
    const { room_id } = req.body;
    const userId = req.user.Student_ID;

    if (!room_id) {
      return res.status(400).json({ message: "room_id is required" });
    }

    const [membership] = await db.query(
      `SELECT Member_ID FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [room_id, userId],
    );

    if (membership.length === 0) {
      return res
        .status(403)
        .json({ message: "You are not a member of this room" });
    }

    const memberId = membership[0].Member_ID;

    const [unread] = await db.query(
      `SELECT c.Message_ID FROM chats_tbl c
       LEFT JOIN chats_seen_tbl cs
         ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
       WHERE c.Room_ID = ?
         AND c.Sender_ID != ?
         AND c.Is_Deleted = 0
         AND cs.Seen_ID IS NULL`,
      [memberId, room_id, userId],
    );

    if (unread.length > 0) {
      const messageIds = unread.map((row) => row.Message_ID);
      const placeholders = messageIds.map(() => `(?, ?)`).join(",");
      const flatParams = [];
      messageIds.forEach((msgId) => {
        flatParams.push(msgId, memberId);
      });

      await db.query(
        `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES ${placeholders}`,
        flatParams,
      );
    }

    res.json({ message: "Messages marked as seen", count: unread.length });
  } catch (error) {
    console.error("markMessagesSeen error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
