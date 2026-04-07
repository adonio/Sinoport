import { Navigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, CountingPanel, getInboundFlight, InboundFlightAppShell, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundBreakdownPage() {
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const { taskMap, setTaskMap } = useInboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  const waybills = buildFlightWaybills(flight.flightNo);

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap} showHero={false}>
      <CountingPanel flightNo={flight.flightNo} waybills={waybills} taskMap={taskMap} setTaskMap={setTaskMap} />
    </InboundFlightAppShell>
  );
}
