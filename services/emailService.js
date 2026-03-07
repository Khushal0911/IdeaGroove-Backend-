import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const getBlockTemplate = (
  studentName,
  contentType,
  contentTitle,
  reason,
  extraInfo,
) => `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: #166534; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px;">IdeaGroove</h1>
      <p style="color: #86efac; margin: 4px 0 0; font-size: 13px;">Content Moderation Notice</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Your <strong>${contentType}</strong> titled 
        <strong>"${contentTitle}"</strong> has been 
        <span style="color: #dc2626; font-weight: bold;">blocked</span> 
        by our admin team.
      </p>

      ${
        extraInfo
          ? `
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 13px;">${extraInfo}</p>
      </div>`
          : ""
      }

      ${
        reason
          ? `
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${reason}</p>
      </div>`
          : ""
      }

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        If you believe this was a mistake, please contact our support team or raise a complaint through the platform.
      </p>
      <p style="color: #374151; font-size: 14px; margin-top: 24px;">— IdeaGroove Admin Team</p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

const getUnblockTemplate = (
  studentName,
  contentType,
  contentTitle,
  extraInfo,
) => `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: #166534; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px;">IdeaGroove</h1>
      <p style="color: #86efac; margin: 4px 0 0; font-size: 13px;">Content Restored</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Great news! Your <strong>${contentType}</strong> titled 
        <strong>"${contentTitle}"</strong> has been 
        <span style="color: #16a34a; font-weight: bold;">unblocked</span> 
        and is now visible to the community again.
      </p>

      ${
        extraInfo
          ? `
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 13px;">${extraInfo}</p>
      </div>`
          : ""
      }

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Thank you for your contributions to IdeaGroove. Keep sharing knowledge with the community!
      </p>
      <p style="color: #374151; font-size: 14px; margin-top: 24px;">— IdeaGroove Admin Team</p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

export const sendBlockEmail = async ({
  toEmail,
  studentName,
  contentType,
  contentTitle,
  reason,
  extraInfo,
}) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your ${contentType} has been blocked - IdeaGroove`,
    html: getBlockTemplate(
      studentName,
      contentType,
      contentTitle,
      reason,
      extraInfo,
    ),
  });
};

export const sendUnblockEmail = async ({
  toEmail,
  studentName,
  contentType,
  contentTitle,
  extraInfo,
}) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your ${contentType} has been restored - IdeaGroove`,
    html: getUnblockTemplate(studentName, contentType, contentTitle, extraInfo),
  });
};

const getComplaintStatusTemplate = (
  studentName,
  complaintText,
  oldStatus,
  newStatus,
  reason,
) => `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: #166534; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px;">IdeaGroove</h1>
      <p style="color: #86efac; margin: 4px 0 0; font-size: 13px;">Complaint Status Update</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Your complaint status has been updated from 
        <strong>${oldStatus}</strong> to 
        <strong style="color: ${
          newStatus === "Resolved"
            ? "#16a34a"
            : newStatus === "In-Progress"
              ? "#d97706"
              : "#dc2626"
        };">${newStatus}</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Your Complaint</p>
        <p style="margin: 8px 0 0; color: #374151; font-size: 13px; line-height: 1.6;">${complaintText}</p>
      </div>

      ${
        reason
          ? `
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 13px;"><strong>Admin Note:</strong> ${reason}</p>
      </div>`
          : ""
      }

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-top: 16px;">
        If you have any further concerns, feel free to raise a new complaint through the platform.
      </p>
      <p style="color: #374151; font-size: 14px; margin-top: 24px;">— IdeaGroove Admin Team</p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

export const sendComplaintStatusEmail = async ({
  toEmail,
  studentName,
  complaintText,
  oldStatus,
  newStatus,
  reason,
}) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your complaint has been ${newStatus} - IdeaGroove`,
    html: getComplaintStatusTemplate(
      studentName,
      complaintText,
      oldStatus,
      newStatus,
      reason,
    ),
  });
};

const getStudentBlockTemplate = (studentName, reason) => `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: #166534; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px;">IdeaGroove</h1>
      <p style="color: #86efac; margin: 4px 0 0; font-size: 13px;">Account Notice</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Your <strong>IdeaGroove account</strong> has been
        <span style="color: #dc2626; font-weight: bold;">suspended</span>
        by our admin team.
      </p>
      ${
        reason
          ? `
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>Reason:</strong> ${reason}</p>
      </div>`
          : ""
      }
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        You will not be able to log in or access the platform until your account is reinstated.
        If you believe this was a mistake, please contact our support team.
      </p>
      <p style="color: #374151; font-size: 14px; margin-top: 24px;">— IdeaGroove Admin Team</p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

const getStudentUnblockTemplate = (studentName) => `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: #166534; padding: 24px 32px;">
      <h1 style="color: white; margin: 0; font-size: 20px;">IdeaGroove</h1>
      <p style="color: #86efac; margin: 4px 0 0; font-size: 13px;">Account Reinstated</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Great news! Your <strong>IdeaGroove account</strong> has been
        <span style="color: #16a34a; font-weight: bold;">reinstated</span>.
        You can now log in and access the platform normally.
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Thank you for being a part of IdeaGroove. We look forward to seeing your contributions!
      </p>
      <p style="color: #374151; font-size: 14px; margin-top: 24px;">— IdeaGroove Admin Team</p>
    </div>
    <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

export const sendStudentBlockEmail = async ({
  toEmail,
  studentName,
  reason,
}) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your IdeaGroove account has been suspended`,
    html: getStudentBlockTemplate(studentName, reason),
  });
};

export const sendStudentUnblockEmail = async ({ toEmail, studentName }) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your IdeaGroove account has been reinstated`,
    html: getStudentUnblockTemplate(studentName),
  });
};
