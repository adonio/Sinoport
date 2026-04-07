import { Navigate, useParams } from 'react-router-dom';

import { getOutboundFlight, OutboundFlightAppShell, OutboundOverviewPanel, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundFlightPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { pmcBoards, receiptMap } = useOutboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight}>
      <OutboundOverviewPanel flight={flight} pmcBoards={pmcBoards} receiptMap={receiptMap} />
    </OutboundFlightAppShell>
  );
}
