import { Navigate, useParams } from 'react-router-dom';

import { getOutboundFlight, LoadingPanel, OutboundFlightAppShell, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundLoadingPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { pmcBoards, setPmcBoards } = useOutboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <LoadingPanel flightNo={flight.flightNo} pmcBoards={pmcBoards} setPmcBoards={setPmcBoards} />
    </OutboundFlightAppShell>
  );
}
