// Contact files (.vcf), the format iPhone Contacts imports. Used to save
// a class's families to her phone before making a WhatsApp broadcast list.

// Commas, semicolons and backslashes have special meanings in vCards.
const escape = (text) => text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;')

// entries = [{ name: 'Laura (mum) · Sofía · Kids A1', phone: '+5491155551234' }]
export function buildVcard(entries) {
  return entries
    .map((e) =>
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escape(e.name)}`,
        `N:;${escape(e.name)};;;`,
        `TEL;TYPE=CELL:${e.phone}`,
        'END:VCARD',
      ].join('\r\n'),
    )
    .join('\r\n')
}
