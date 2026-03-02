import { Server } from "socket.io";

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
        // Lazy-import db so socket file stays independent
        const { default: db } = await import("../config/db.js");

        const [messages] = await db.query(
          `SELECT
             c.Message_ID,
             c.Room_ID,
             c.Sender_ID,
             s.username  AS Sender_Username,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type,
             c.Message_Text,
             c.Sent_On,
             c.Is_Edited,
             c.Is_Deleted,
             EXISTS(
               SELECT 1 FROM chats_seen_tbl cs
               WHERE cs.Message_ID = c.Message_ID AND cs.Member_ID != c.Sender_ID
               LIMIT 1
             ) AS Is_Seen
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Room_ID = ?
           ORDER BY c.Sent_On ASC
           LIMIT 50`,
          [roomId],
        );

        socket.emit("room:history", { roomId, messages });

        // Mark all messages in this room as seen by this student
        if (studentId) {
          const [unread] = await db.query(
            `SELECT c.Message_ID FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [studentId, roomId, studentId],
          );

          for (const row of unread) {
            await db.query(
              `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
              [row.Message_ID, studentId],
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

        // Insert message
        const [result] = await db.query(
          `INSERT INTO chats_tbl (Room_ID, Sender_ID, Message_Type, Message_Text)
           VALUES (?, ?, 'text', ?)`,
          [roomId, studentId, message.trim()],
        );

        // Fetch the inserted message with sender info
        const [rows] = await db.query(
          `SELECT
             c.Message_ID,
             c.Room_ID,
             c.Sender_ID,
             s.username  AS Sender_Username,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type,
             c.Message_Text,
             c.Sent_On,
             c.Is_Edited,
             c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Message_ID = ?`,
          [result.insertId],
        );

        const newMessage = rows[0];

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
             c.Message_Type, c.Message_Text,
             c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Room_ID = ?
           ORDER BY c.Sent_On ASC
           LIMIT 50 OFFSET ?`,
          [roomId, offset],
        );

        socket.emit("message:more", { roomId, messages });
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

        const [unread] = await db.query(
          `SELECT c.Message_ID FROM chats_tbl c
           LEFT JOIN chats_seen_tbl cs
             ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
           WHERE c.Room_ID = ?
             AND c.Sender_ID != ?
             AND c.Is_Deleted = 0
             AND cs.Seen_ID IS NULL`,
          [studentId, roomId, studentId],
        );

        for (const row of unread) {
          await db.query(
            `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
            [row.Message_ID, studentId],
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

        // For file messages, Message_Text stores the URL, Message_Type = 'image' or 'file'
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

        const [result] = await db.query(
          `UPDATE chats_tbl SET Message_Text = ?, Is_Edited = 1
       WHERE Message_ID = ? AND Sender_ID = ? AND Is_Deleted = 0`,
          [newText.trim(), messageId, studentId],
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
        const counts = {};

        for (const roomId of roomIds) {
          const [rows] = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [studentId, roomId, studentId],
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
