import { Navigate, useParams } from 'react-router-dom';

import { ContainerCreatePanel, getOutboundFlight, OutboundFlightAppShell, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundPmcNewPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { pmcBoards, setPmcBoards } = useOutboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <ContainerCreatePanel flightNo={flight.flightNo} pmcBoards={pmcBoards} setPmcBoards={setPmcBoards} />
    </OutboundFlightAppShell>
  );
}
