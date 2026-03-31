import { isStudentActive } from "./studentVisibility.js";

export const CHAT_UNAVAILABLE_MESSAGE =
  "This chat is unavailable because one of the accounts is inactive.";
export const INACTIVE_ACCOUNT_MESSAGE = "This account is inactive.";

export const getRoomSendPermission = async (executor, roomId, studentId) => {
  const [membership] = await executor.query(
    `SELECT r.Room_ID, LOWER(r.Room_Type) AS Room_Type
     FROM chat_room_members_tbl m
     JOIN chat_rooms_tbl r ON r.Room_ID = m.Room_ID
     WHERE m.Room_ID = ?
       AND m.Student_ID = ?
       AND m.Is_Active = 1
       AND r.Is_Active = 1
     LIMIT 1`,
    [roomId, studentId],
  );

  if (membership.length === 0) {
    return {
      allowed: false,
      status: 403,
      message: "Access denied",
    };
  }

  const senderActive = await isStudentActive(executor, studentId);
  if (!senderActive) {
    return {
      allowed: false,
      status: 403,
      message: INACTIVE_ACCOUNT_MESSAGE,
    };
  }

  if (membership[0].Room_Type === "direct") {
    const [inactiveParticipants] = await executor.query(
      `SELECT m.Student_ID
       FROM chat_room_members_tbl m
       JOIN student_tbl s ON s.S_ID = m.Student_ID
       WHERE m.Room_ID = ?
         AND m.Is_Active = 1
         AND s.is_Active = 0
       LIMIT 1`,
      [roomId],
    );

    if (inactiveParticipants.length > 0) {
      return {
        allowed: false,
        status: 403,
        message: CHAT_UNAVAILABLE_MESSAGE,
      };
    }
  }

  return {
    allowed: true,
    roomType: membership[0].Room_Type,
  };
};
