import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const getBlockTemplate = (studentName, contentType, contentTitle, reason) => `
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

const getUnblockTemplate = (studentName, contentType, contentTitle) => `
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
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Thank you for your contributions to IdeaGroove.
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
}) => {
  await transporter.sendMail({
    from: `"IdeaGroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your ${contentType} has been blocked - Ideagroove`,
    html: getBlockTemplate(studentName, contentType, contentTitle, reason),
  });
};

export const sendUnblockEmail = async ({
  toEmail,
  studentName,
  contentType,
  contentTitle,
}) => {
  await transporter.sendMail({
    from: `"Ideagroove Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your ${contentType} has been unblocked - Ideagroove`,
    html: getUnblockTemplate(studentName, contentType, contentTitle),
  });
};
