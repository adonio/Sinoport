import { Navigate, useParams } from 'react-router-dom';

import { ContainerListPanel, getOutboundFlight, OutboundFlightAppShell, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundPmcPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { pmcBoards, setPmcBoards } = useOutboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <ContainerListPanel flightNo={flight.flightNo} pmcBoards={pmcBoards} />
    </OutboundFlightAppShell>
  );
}
