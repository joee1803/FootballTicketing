const QRCode = require("qrcode");

async function buildTicketQrCode({ ticketId, matchId, ownerAddress }) {
  return QRCode.toDataURL(
    JSON.stringify({
      ticketId,
      matchId,
      ownerAddress
    })
  );
}

module.exports = {
  buildTicketQrCode
};
