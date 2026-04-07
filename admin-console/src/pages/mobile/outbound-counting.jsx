import { Navigate, useParams } from 'react-router-dom';

import { CountingPanel } from 'pages/mobile/inbound-shared';
import { buildOutboundWaybills, getOutboundFlight, OutboundFlightAppShell } from 'pages/mobile/outbound-shared';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { readMobileSession } from 'utils/mobile/session';

function stationKeyOf(session) {
  return (session?.station || 'default').replace(/\s+/g, '-');
}

export default function MobileOutboundCountingPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const session = readMobileSession();
  const stationKey = stationKeyOf(session);
  const { state: taskMap, setState: setTaskMap } = useLocalStorage(`sinoport-mobile-outbound-counts-${stationKey}`, {});

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  const waybills = buildOutboundWaybills(flight.flightNo);

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <CountingPanel flightNo={flight.flightNo} waybills={waybills} taskMap={taskMap} setTaskMap={setTaskMap} />
    </OutboundFlightAppShell>
  );
}
