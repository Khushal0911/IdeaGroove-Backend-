import { Server } from "socket.io";
import { encryptMessage, decryptMessage } from "../utils/chatEncryption.js";

/**
 * Initialise Socket.io and attach all chat event handlers.
 * Call this once in server.js after app.listen().
 *
 * @param {import('http').Server} httpServer  – the Node http.Server instance
 */
export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Map: studentId -> socketId  (track online users)
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    /* ──────────────────────────────────────────────
       USER ONLINE
    ────────────────────────────────────────────── */
    socket.on("user:online", ({ studentId }) => {
      if (!studentId) return;
      onlineUsers.set(String(studentId), socket.id);
      socket.data.studentId = String(studentId);

      // Tell everyone this user is online
      io.emit("user:status", { studentId, status: "online" });

      // Send the newly connected user the full current online list
      const currentOnline = Array.from(onlineUsers.keys());
      socket.emit("users:online_list", { onlineUserIds: currentOnline });
    });

    /* ──────────────────────────────────────────────
       SUBSCRIBE TO ROOM (background subscription)
       Client emits: { roomId }
       Just joins the socket room — no history, no mark-seen.
       Used to receive message:new for rooms not currently open.
    ────────────────────────────────────────────── */
    socket.on("room:subscribe", ({ roomId }) => {
      if (!roomId) return;
      socket.join(String(roomId));
    });

    /* ──────────────────────────────────────────────
       JOIN ROOM
       Client emits: { roomId, studentId }
       Server responds with room message history
    ────────────────────────────────────────────── */
    socket.on("room:join", async ({ roomId, studentId }) => {
      if (!roomId) return;

      socket.join(String(roomId));

      try {
        const { default: db } = await import("../config/db.js");

        // Get Member_ID first (needed for proper seen tracking)
        let memberId = null;
        if (studentId) {
          const [memberData] = await db.query(
            `SELECT Member_ID FROM chat_room_members_tbl
             WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
            [roomId, studentId],
          );
          if (memberData.length > 0) {
            memberId = memberData[0].Member_ID;
          }
        }

        const [messages] = await db.query(
          `SELECT
             c.Message_ID,
             c.Room_ID,
             c.Sender_ID,
             s.username  AS Sender_Username,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type,
             c.Message_Text,
             c.Encryption_IV,
             c.Sent_On,
             c.Is_Edited,
             c.Is_Deleted,
             EXISTS(
               SELECT 1 FROM chats_seen_tbl cs
               WHERE cs.Message_ID = c.Message_ID AND cs.Member_ID = ?
               LIMIT 1
             ) AS Is_Seen
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Room_ID = ? AND c.Is_Deleted = 0
           ORDER BY c.Sent_On ASC
           LIMIT 50`,
          [memberId, roomId],
        );

        // Decrypt messages before sending to client
        const decryptedMessages = messages.map((msg) => {
          if (
            msg.Message_Text &&
            msg.Encryption_IV &&
            msg.Message_Type === "text"
          ) {
            try {
              return {
                ...msg,
                Message_Text: decryptMessage(
                  msg.Message_Text,
                  msg.Encryption_IV,
                ),
              };
            } catch (err) {
              console.error("[Socket] room:join decryption error:", err);
              return msg;
            }
          }
          return msg;
        });

        socket.emit("room:history", { roomId, messages: decryptedMessages });

        // Mark all unread messages in this room as seen by this member
        if (memberId) {
          const [unread] = await db.query(
            `SELECT c.Message_ID FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [memberId, roomId, studentId],
          );

          for (const row of unread) {
            await db.query(
              `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
              [row.Message_ID, memberId],
            );
          }

          // Notify room that messages were seen
          socket.to(String(roomId)).emit("message:seen_update", {
            roomId,
            seenBy: studentId,
          });
        }
      } catch (err) {
        console.error("[Socket] room:join error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       LEAVE ROOM
    ────────────────────────────────────────────── */
    socket.on("room:leave", ({ roomId }) => {
      if (roomId) socket.leave(String(roomId));
    });

    /* ──────────────────────────────────────────────
       SEND MESSAGE
       Client emits: { roomId, message }
    ────────────────────────────────────────────── */
    socket.on("message:send", async ({ roomId, message }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !message?.trim() || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        // Verify membership
        const [membership] = await db.query(
          `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
          [roomId, studentId],
        );

        if (membership.length === 0) {
          socket.emit("error", {
            message: "You are not a member of this room",
          });
          return;
        }

        // Encrypt the message
        const { encryptedData, iv } = encryptMessage(message.trim());

        // Insert encrypted message
        const [result] = await db.query(
          `INSERT INTO chats_tbl (Room_ID, Sender_ID, Message_Type, Message_Text, Encryption_IV)
           VALUES (?, ?, 'text', ?, ?)`,
          [roomId, studentId, encryptedData, iv],
        );

        // Fetch inserted message with sender info
        const [rows] = await db.query(
          `SELECT
             c.Message_ID,
             c.Room_ID,
             c.Sender_ID,
             s.username  AS Sender_Username,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type,
             c.Message_Text,
             c.Encryption_IV,
             c.Sent_On,
             c.Is_Edited,
             c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Message_ID = ?`,
          [result.insertId],
        );

        const newMessage = rows[0];

        // Decrypt before broadcast
        if (newMessage.Message_Text && newMessage.Encryption_IV) {
          try {
            newMessage.Message_Text = decryptMessage(
              newMessage.Message_Text,
              newMessage.Encryption_IV,
            );
          } catch (err) {
            console.error("[Socket] message:send decryption error:", err);
          }
        }

        // Broadcast to everyone in the room (including sender)
        io.to(String(roomId)).emit("message:new", {
          roomId: Number(roomId),
          message: newMessage,
        });
      } catch (err) {
        console.error("[Socket] message:send error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    /* ──────────────────────────────────────────────
       LOAD MORE (pagination)
       Client emits: { roomId, offset }
    ────────────────────────────────────────────── */
    socket.on("message:load_more", async ({ roomId, offset = 0 }) => {
      try {
        const { default: db } = await import("../config/db.js");

        const [messages] = await db.query(
          `SELECT
             c.Message_ID, c.Room_ID, c.Sender_ID,
             s.username AS Sender_Username,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type, c.Message_Text, c.Encryption_IV,
             c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Room_ID = ? AND c.Is_Deleted = 0
           ORDER BY c.Sent_On ASC
           LIMIT 50 OFFSET ?`,
          [roomId, offset],
        );

        // Decrypt messages before sending
        const decryptedMessages = messages.map((msg) => {
          if (
            msg.Message_Text &&
            msg.Encryption_IV &&
            msg.Message_Type === "text"
          ) {
            try {
              return {
                ...msg,
                Message_Text: decryptMessage(
                  msg.Message_Text,
                  msg.Encryption_IV,
                ),
              };
            } catch (err) {
              console.error(
                "[Socket] message:load_more decryption error:",
                err,
              );
              return msg;
            }
          }
          return msg;
        });

        socket.emit("message:more", { roomId, messages: decryptedMessages });
      } catch (err) {
        console.error("[Socket] message:load_more error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       MARK SEEN
       Client emits: { roomId }
    ────────────────────────────────────────────── */
    socket.on("message:seen", async ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        // Get Member_ID first
        const [memberData] = await db.query(
          `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
          [roomId, studentId],
        );

        if (memberData.length === 0) return;

        const memberId = memberData[0].Member_ID;

        const [unread] = await db.query(
          `SELECT c.Message_ID FROM chats_tbl c
           LEFT JOIN chats_seen_tbl cs
             ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
           WHERE c.Room_ID = ?
             AND c.Sender_ID != ?
             AND c.Is_Deleted = 0
             AND cs.Seen_ID IS NULL`,
          [memberId, roomId, studentId],
        );

        for (const row of unread) {
          await db.query(
            `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
            [row.Message_ID, memberId],
          );
        }

        socket.to(String(roomId)).emit("message:seen_update", {
          roomId,
          seenBy: studentId,
        });
      } catch (err) {
        console.error("[Socket] message:seen error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       SEND FILE/IMAGE
    ────────────────────────────────────────────── */
    socket.on("message:send_file", async ({ roomId, fileUrl, messageType }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !fileUrl || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [membership] = await db.query(
          `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
          [roomId, studentId],
        );
        if (membership.length === 0) return;

        // File messages store URL as Message_Text, no encryption needed
        const [result] = await db.query(
          `INSERT INTO chats_tbl (Room_ID, Sender_ID, Message_Type, Message_Text)
           VALUES (?, ?, ?, ?)`,
          [roomId, studentId, messageType, fileUrl],
        );

        const [rows] = await db.query(
          `SELECT c.Message_ID, c.Room_ID, c.Sender_ID,
              s.username AS Sender_Username, s.Profile_Pic AS Sender_Profile_Pic,
              c.Message_Type, c.Message_Text, c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Message_ID = ?`,
          [result.insertId],
        );

        io.to(String(roomId)).emit("message:new", {
          roomId: Number(roomId),
          message: rows[0],
        });
      } catch (err) {
        console.error("[Socket] message:send_file error:", err);
      }
    });

    /* ── EDIT MESSAGE ──────────────────────────────────────────── */
    socket.on("message:edit", async ({ roomId, messageId, newText }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !messageId || !newText?.trim() || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        // Re-encrypt the edited text with a new IV
        const { encryptedData, iv } = encryptMessage(newText.trim());

        const [result] = await db.query(
          `UPDATE chats_tbl SET Message_Text = ?, Encryption_IV = ?, Is_Edited = 1
           WHERE Message_ID = ? AND Sender_ID = ? AND Is_Deleted = 0`,
          [encryptedData, iv, messageId, studentId],
        );

        if (result.affectedRows > 0) {
          io.to(String(roomId)).emit("message:edited", {
            roomId: Number(roomId),
            messageId,
            newText: newText.trim(),
          });
        }
      } catch (err) {
        console.error("[Socket] message:edit error:", err);
      }
    });

    /* ── DELETE MESSAGE ────────────────────────────────────────── */
    socket.on("message:delete", async ({ roomId, messageId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !messageId || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [result] = await db.query(
          `UPDATE chats_tbl SET Is_Deleted = 1
           WHERE Message_ID = ? AND Sender_ID = ?`,
          [messageId, studentId],
        );

        if (result.affectedRows > 0) {
          io.to(String(roomId)).emit("message:deleted", {
            roomId: Number(roomId),
            messageId,
          });
        }
      } catch (err) {
        console.error("[Socket] message:delete error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       TYPING INDICATORS
    ────────────────────────────────────────────── */
    socket.on("typing:start", ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;
      socket.to(String(roomId)).emit("typing:update", {
        roomId,
        studentId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;
      socket.to(String(roomId)).emit("typing:update", {
        roomId,
        studentId,
        isTyping: false,
      });
    });

    /* ──────────────────────────────────────────────
       UNREAD COUNTS FOR A LIST OF ROOMS
       Client emits: { roomIds: number[] }
    ────────────────────────────────────────────── */
    socket.on("rooms:unread_counts", async ({ roomIds }) => {
      const studentId = socket.data.studentId;
      if (!studentId || !roomIds?.length) return;

      try {
        const { default: db } = await import("../config/db.js");

        // Get Member_IDs for all rooms at once
        const [memberData] = await db.query(
          `SELECT Room_ID, Member_ID FROM chat_room_members_tbl
           WHERE Student_ID = ? AND Is_Active = 1`,
          [studentId],
        );

        const memberMap = {};
        memberData.forEach((m) => {
          memberMap[m.Room_ID] = m.Member_ID;
        });

        const counts = {};

        for (const roomId of roomIds) {
          const memberId = memberMap[roomId];
          if (!memberId) {
            counts[roomId] = 0;
            continue;
          }

          const [rows] = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [memberId, roomId, studentId],
          );
          counts[roomId] = rows[0].cnt;
        }

        socket.emit("rooms:unread_counts", counts);
      } catch (err) {
        console.error("[Socket] rooms:unread_counts error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       DISCONNECT
    ────────────────────────────────────────────── */
    socket.on("disconnect", () => {
      const studentId = socket.data.studentId;
      if (studentId) {
        onlineUsers.delete(studentId);
        io.emit("user:status", { studentId, status: "offline" });
      }
      console.log(`[Socket] disconnected: ${socket.id}`);
    });
  });

  return io;
};
