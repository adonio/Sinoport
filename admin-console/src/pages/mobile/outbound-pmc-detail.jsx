import { Navigate, useParams } from 'react-router-dom';

import { ContainerDetailPanel, getOutboundFlight, OutboundFlightAppShell, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundPmcDetailPage() {
  const { flightNo, containerCode } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { pmcBoards, setPmcBoards } = useOutboundStorage(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <ContainerDetailPanel flightNo={flight.flightNo} containerCode={decodeURIComponent(containerCode)} pmcBoards={pmcBoards} setPmcBoards={setPmcBoards} />
    </OutboundFlightAppShell>
  );
}
