import { Navigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, getInboundFlight, InboundFlightAppShell, InboundOverviewPanel, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundFlightPage() {
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const waybills = flight ? buildFlightWaybills(flight.flightNo) : [];
  const { taskMap } = useInboundStorage(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap}>
      <InboundOverviewPanel flight={flight} waybills={waybills} taskMap={taskMap} />
    </InboundFlightAppShell>
  );
}
