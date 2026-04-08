import { Navigate, useParams } from 'react-router-dom';

import { CountingPanel } from 'pages/mobile/inbound-shared';
import { buildOutboundWaybills, getOutboundFlight, OutboundFlightAppShell } from 'pages/mobile/outbound-shared';
import { useLocalStorage } from 'hooks/useLocalStorage';
import { getMobileStationKey, readMobileSession } from 'utils/mobile/session';

export default function MobileOutboundCountingPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const session = readMobileSession();
  const stationKey = getMobileStationKey(session);
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
