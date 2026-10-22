/** Dental SaaS file-size contract shared by platform upload and read paths. */
export const MEDIA_LIMITS = Object.freeze({
  patient_media: 10 * 1024 * 1024,
  staff_document: 25 * 1024 * 1024,
});

/** Keep the upload and read ceilings tied to the same Dental SaaS contract. */
export const MEDIA_UPLOAD_LIMITS = MEDIA_LIMITS;
