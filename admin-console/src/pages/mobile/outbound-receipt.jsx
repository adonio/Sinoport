import { Navigate, useParams } from 'react-router-dom';

import { getOutboundFlight, OutboundFlightAppShell, ReceiptPanel, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundReceiptPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { receiptMap, setReceiptMap } = useOutboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <ReceiptPanel flightNo={flight.flightNo} receiptMap={receiptMap} setReceiptMap={setReceiptMap} />
    </OutboundFlightAppShell>
  );
}
