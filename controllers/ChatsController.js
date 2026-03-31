import db from "../config/database.js";
import { encryptMessage, decryptMessage } from "../utils/chatEncryption.js";
import {
  CHAT_UNAVAILABLE_MESSAGE,
  INACTIVE_ACCOUNT_MESSAGE,
  getRoomSendPermission,
} from "../utils/chatPermissions.js";
import { isStudentActive } from "../utils/studentVisibility.js";

const DIRECT_ROOM_LOCK_TIMEOUT_SECONDS = 10;

const getDirectRoomParticipantIds = (firstStudentId, secondStudentId) =>
  [Number(firstStudentId), Number(secondStudentId)].sort((a, b) => a - b);

const buildDirectRoomLockKey = (firstStudentId, secondStudentId) => {
  const [smallerStudentId, largerStudentId] = getDirectRoomParticipantIds(
    firstStudentId,
    secondStudentId,
  );

  return `direct_room:${smallerStudentId}:${largerStudentId}`;
};

const findOldestDirectRoom = async (executor, firstStudentId, secondStudentId) => {
  const [smallerStudentId, largerStudentId] = getDirectRoomParticipantIds(
    firstStudentId,
    secondStudentId,
  );

  const [rooms] = await executor.query(
    `SELECT r.Room_ID
     FROM chat_rooms_tbl r
     JOIN chat_room_members_tbl m
       ON r.Room_ID = m.Room_ID
      AND m.Is_Active = 1
     WHERE r.Room_Type = 'direct'
       AND r.Is_Active = 1
     GROUP BY r.Room_ID
     HAVING COUNT(DISTINCT m.Student_ID) = 2
       AND SUM(m.Student_ID = ?) > 0
       AND SUM(m.Student_ID = ?) > 0
     ORDER BY r.Room_ID ASC
     LIMIT 1`,
    [smallerStudentId, largerStudentId],
  );

  return rooms[0]?.Room_ID || null;
};

/**
 * POST /api/chats/create-room
 */
export const createChatRoom = async (req, res) => {
  const connection = await db.getConnection();
  let transactionStarted = false;
  let directRoomLockKey = null;

  try {
    const { receiver_id, room_type = "direct" } = req.body;
    const senderId = Number(req.user.Student_ID);
    const receiverId = Number(receiver_id);

    if (room_type !== "direct") {
      return res.status(400).json({ message: "Invalid room_type" });
    }

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return res
        .status(400)
        .json({ message: "receiver_id is required for direct chat" });
    }

    if (receiverId === senderId) {
      return res.status(400).json({ message: "You cannot chat with yourself" });
    }

    const senderActive = await isStudentActive(connection, senderId);
    if (!senderActive) {
      return res.status(403).json({ message: INACTIVE_ACCOUNT_MESSAGE });
    }

    const receiverActive = await isStudentActive(connection, receiverId);
    if (!receiverActive) {
      return res.status(403).json({ message: CHAT_UNAVAILABLE_MESSAGE });
    }

    directRoomLockKey = buildDirectRoomLockKey(senderId, receiverId);

    const [lockRows] = await connection.query(
      `SELECT GET_LOCK(?, ?) AS Lock_Acquired`,
      [directRoomLockKey, DIRECT_ROOM_LOCK_TIMEOUT_SECONDS],
    );

    if (Number(lockRows?.[0]?.Lock_Acquired) !== 1) {
      return res.status(503).json({
        message: "Unable to start this chat right now. Please try again.",
      });
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const existingRoomId = await findOldestDirectRoom(
      connection,
      senderId,
      receiverId,
    );

    if (existingRoomId) {
      await connection.commit();
      transactionStarted = false;

      return res.status(200).json({
        message: "Room already exists",
        roomId: existingRoomId,
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
      [roomId, senderId, roomId, receiverId],
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({ message: "Direct room created", roomId });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    console.error("createChatRoom error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (directRoomLockKey) {
      try {
        await connection.query(`SELECT RELEASE_LOCK(?)`, [directRoomLockKey]);
      } catch (releaseError) {
        console.error("createChatRoom release lock error:", releaseError);
      }
    }

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
        r.Created_On,
        r.Created_By,
        creator.name AS Creator_Name,
        creator.username AS Creator_Username,
        CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM student_tbl self_student
            WHERE self_student.S_ID = ?
              AND self_student.is_Active = 1
          ) THEN 0
          WHEN LOWER(r.Room_Type) = 'direct'
            AND EXISTS (
              SELECT 1
              FROM chat_room_members_tbl direct_members
              JOIN student_tbl direct_students
                ON direct_members.Student_ID = direct_students.S_ID
              WHERE direct_members.Room_ID = r.Room_ID
                AND direct_members.Is_Active = 1
                AND direct_students.is_Active = 0
            ) THEN 0
          ELSE 1
        END AS Can_Send,
        (
          SELECT Message_Text FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Message,
        (
          SELECT Message_Type FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Type,
        (
          SELECT Encryption_IV FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_IV,
        (
          SELECT Sent_On FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Message_At,
        (
          SELECT Sender_ID FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Sender_ID,
        (
          SELECT Is_Deleted FROM chats_tbl
          WHERE Room_ID = r.Room_ID
            AND Sent_On >= m.Joined_On
          ORDER BY Sent_On DESC LIMIT 1
        ) AS Last_Is_Deleted,
        (
          SELECT s3.name
          FROM chats_tbl c3
          JOIN student_tbl s3 ON c3.Sender_ID = s3.S_ID
          WHERE c3.Room_ID = r.Room_ID
            AND c3.Sent_On >= m.Joined_On
          ORDER BY c3.Sent_On DESC LIMIT 1
        ) AS Last_Sender_Name,
        (
          SELECT s3.username
          FROM chats_tbl c3
          JOIN student_tbl s3 ON c3.Sender_ID = s3.S_ID
          WHERE c3.Room_ID = r.Room_ID
            AND c3.Sent_On >= m.Joined_On
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
                AND c4.Sent_On >= m.Joined_On
              ORDER BY c4.Sent_On DESC LIMIT 1
            )
              AND m4.Room_ID = r.Room_ID
              AND m4.Is_Active = 1
              AND m4.Student_ID != (
                SELECT c5.Sender_ID
                FROM chats_tbl c5
                WHERE c5.Room_ID = r.Room_ID
                  AND c5.Sent_On >= m.Joined_On
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
            AND c2.Sent_On >= m.Joined_On
            AND cs2.Seen_ID IS NULL
        ) AS Unread_Count,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'Student_ID', s2.S_ID,
              'role', m2.Role,
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
      LEFT JOIN student_tbl creator ON r.Created_By = creator.S_ID
      JOIN (
        SELECT
          Room_ID,
          Student_ID,
          MAX(Member_ID) AS Member_ID,
          MAX(Joined_On) AS Joined_On
        FROM chat_room_members_tbl
        WHERE Student_ID = ? AND Is_Active = 1
        GROUP BY Room_ID, Student_ID
      ) m ON r.Room_ID = m.Room_ID
      WHERE r.Is_Active = 1
      ORDER BY Last_Message_At DESC`,
      [userId, userId],
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

    const permission = await getRoomSendPermission(connection, room_id, senderId);
    if (!permission.allowed) {
      await connection.rollback();
      return res
        .status(permission.status || 403)
        .json({ message: permission.message });
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
      `SELECT Member_ID, Joined_On FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [roomId, userId],
    );

    if (membership.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const joinedOn = membership[0]?.Joined_On || null;

    const [messages] = await db.query(
      `SELECT c.*, s.username AS Sender_Username, s.name AS Sender_Name, s.Profile_Pic AS Sender_Profile_Pic
       FROM chats_tbl c
       JOIN student_tbl s ON c.Sender_ID = s.S_ID
       WHERE c.Room_ID = ?
         AND (? IS NULL OR c.Sent_On >= ?)
       ORDER BY c.Sent_On ASC`,
      [roomId, joinedOn, joinedOn],
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
      `SELECT Member_ID, Joined_On FROM chat_room_members_tbl
       WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
      [room_id, userId],
    );

    if (membership.length === 0) {
      return res
        .status(403)
        .json({ message: "You are not a member of this room" });
    }

    const memberId = membership[0].Member_ID;
    const joinedOn = membership[0].Joined_On || null;

    const [unread] = await db.query(
      `SELECT c.Message_ID FROM chats_tbl c
       LEFT JOIN chats_seen_tbl cs
         ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
       WHERE c.Room_ID = ?
         AND c.Sender_ID != ?
         AND c.Is_Deleted = 0
         AND (? IS NULL OR c.Sent_On >= ?)
         AND cs.Seen_ID IS NULL`,
      [memberId, room_id, userId, joinedOn, joinedOn],
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

/**
 * GET /api/chats/message-info/:messageId
 */
export const getMessageInfo = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.Student_ID;

    const [messages] = await db.query(
      `SELECT
         c.Message_ID,
         c.Room_ID,
         c.Sender_ID,
         c.Message_Type,
         c.Message_Text,
         c.File_Path,
         c.Encryption_IV,
         c.Sent_On,
         c.Is_Deleted,
         r.Room_Type,
         r.Room_Name,
         s.name AS Sender_Name,
         s.username AS Sender_Username
       FROM chats_tbl c
       JOIN chat_rooms_tbl r ON c.Room_ID = r.Room_ID
       JOIN student_tbl s ON c.Sender_ID = s.S_ID
       JOIN chat_room_members_tbl self_member
         ON self_member.Room_ID = c.Room_ID
        AND self_member.Student_ID = ?
        AND self_member.Is_Active = 1
       WHERE c.Message_ID = ?
       LIMIT 1`,
      [userId, messageId],
    );

    if (messages.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const message = messages[0];

    if (!message.Is_Deleted) {
      const encryptedContent =
        message.Message_Type === "text" ? message.Message_Text : message.File_Path;

      if (encryptedContent && message.Encryption_IV) {
        try {
          const decrypted = decryptMessage(
            encryptedContent,
            message.Encryption_IV,
          );
          if (message.Message_Type === "text") {
            message.Message_Text = decrypted;
          } else {
            message.File_Path = decrypted;
          }
        } catch (err) {
          console.error("getMessageInfo decrypt failed:", err);
        }
      }
    }

    const [receipts] = await db.query(
      `SELECT
         m.Student_ID,
         m.Role,
         m.Joined_On,
         s.name,
         s.username,
         s.Profile_Pic,
         cs.Seen_On
       FROM chat_room_members_tbl m
       JOIN student_tbl s ON m.Student_ID = s.S_ID
       LEFT JOIN chats_seen_tbl cs
         ON cs.Member_ID = m.Member_ID
        AND cs.Message_ID = ?
       WHERE m.Room_ID = ?
         AND m.Is_Active = 1
         AND m.Student_ID != ?
       ORDER BY
         CASE WHEN cs.Seen_On IS NULL THEN 1 ELSE 0 END,
         cs.Seen_On ASC,
         s.name ASC,
         s.username ASC`,
      [message.Message_ID, message.Room_ID, message.Sender_ID],
    );

    const formattedReceipts = receipts.map((receipt) => ({
      ...receipt,
      Status: receipt.Seen_On ? "seen" : "delivered",
    }));

    res.json({
      status: true,
      data: {
        message: {
          Message_ID: message.Message_ID,
          Room_ID: message.Room_ID,
          Sender_ID: message.Sender_ID,
          Sender_Name: message.Sender_Name,
          Sender_Username: message.Sender_Username,
          Message_Type: message.Message_Type,
          Message_Text: message.Message_Text,
          File_Path: message.File_Path,
          Sent_On: message.Sent_On,
          Is_Deleted: message.Is_Deleted,
        },
        room: {
          Room_ID: message.Room_ID,
          Room_Type: message.Room_Type,
          Room_Name: message.Room_Name,
        },
        receipts: formattedReceipts,
      },
    });
  } catch (error) {
    console.error("getMessageInfo error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
