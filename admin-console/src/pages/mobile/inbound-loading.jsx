import { Navigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, getInboundFlight, InboundFlightAppShell, LoadingPanel, useInboundLoadingStorage, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundLoadingPage() {
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const { taskMap } = useInboundStorage(flightNo);
  const { loadingPlans, setLoadingPlans } = useInboundLoadingStorage(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  const waybills = buildFlightWaybills(flight.flightNo);

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap} showHero={false}>
      <LoadingPanel flightNo={flight.flightNo} loadingPlans={loadingPlans} setLoadingPlans={setLoadingPlans} />
    </InboundFlightAppShell>
  );
}
