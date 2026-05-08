export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  previewImage?: string; // Optional if we want to show a small mock doc preview
  fullContent: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "1",
    title: "Transmittal of Documents for Signature",
    category: "Communication",
    description: "A formal cover letter for sending documents that require a signature.",
    fullContent: `[DATE]\n\n[CONTACT NAME]\n[ADDRESS]\n\nSUBJECT: TRANSMITTAL OF DOCUMENTS FOR SIGNATURE\n\nDear [CONTACT NAME],\n\nThe following documents are enclosed and require your signature:\n\n- [DOCUMENT 1]\n- [DOCUMENT 2]\n\nPlease execute your signature where indicated and return the originals to this office. The copies that we have provided are for your files.\n\nThank you for your previous collaboration.\n\nSincerely,\n\n[YOUR NAME]\n[YOUR TITLE]`,
  },
  {
    id: "2",
    title: "Legal Service Agreement",
    category: "Contracts",
    description: "A standard agreement between a law firm and a client for legal services.",
    fullContent: `LEGAL SERVICE AGREEMENT\n\nThis Legal Service Agreement is made effective [DATE],\n\nBETWEEN: [CLIENT NAME], with a principal place of business located at [ADDRESS]\n\nAND: [LAW FIRM NAME], with a principal place of business located at [ADDRESS]\n\n1. SCOPE OF SERVICES\nThe Service Provider agrees to provide the following legal services to the Client...\n\n2. FEES AND PAYMENT\nThe Client agrees to pay the Service Provider...`,
  },
  {
    id: "3",
    title: "Checklist Documents to Bring to Your Attorney",
    category: "Checklists",
    description: "A helpful checklist for clients to prepare before meeting their attorney.",
    fullContent: `CHECKLIST\nDOCUMENTS TO BRING TO YOUR ATTORNEY\n\nEverybody in business knows that suing someone or being sued yourself is an extremely stressful and often time-consuming process. To make your initial consultation as productive as possible, please bring the following documents:\n\n[ ] Summons and Complaint\n[ ] All correspondence with the other party\n[ ] Insurance policies\n[ ] Incorporation documents\n[ ] Contracts\n[ ] Invoices or receipts`,
  },
  {
    id: "4",
    title: "Contract on Retaining Legal Counsel",
    category: "Contracts",
    description: "An agreement to officially retain a lawyer or law firm for specific legal representation.",
    fullContent: `CONTRACT ON RETAINING LEGAL COUNSEL\n\nThis Agreement for Contract on Retaining Legal Counsel is made and effective [DATE],\n\nBETWEEN: [YOUR COMPANY NAME] (the "Client")\n\nAND: [COMPANY NAME] (the "Legal Counsel")\n\n1. Legal Counsel will provide the following services:\n- Providing answers to legal questions\n- Assisting in drafting and reviewing contracts\n- Participating in contract negotiation`,
  },
  {
    id: "5",
    title: "Website Legal Notice",
    category: "Notices",
    description: "Standard terms, conditions, and copyright notices for a business website.",
    fullContent: `WEBSITE LEGAL NOTICE\n\n© Copyright [COMPANY YEAR]. All rights reserved.\n\nTERMS AND CONDITIONS OF USE\nWelcome to the corporate website of [COMPANY]. Use of this site is governed by the Terms and Conditions set forth. PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE USING THIS WEBSITE.\n\nOWNERSHIP OF INFORMATION AND MATERIALS\nThe information and any materials available on or from this website are the copyrighted works of [COMPANY]...`,
  },
  {
    id: "6",
    title: "Standard Operation Procedure",
    category: "Operations",
    description: "Internal and external document identification procedure.",
    fullContent: `STANDARD OPERATION PROCEDURE\nHow to Have Control of Your Documents & Company Data\n\nDepartment: All departments\n\nPurpose: The purpose of this Standard Operating Procedure document is to guide you on how to have better control over all corporate documents and data.\n\nFrequency: When needed\n\nProcedure:\n1. Be aware of document control policies\n2. Use standardized naming conventions...`,
  },
];
