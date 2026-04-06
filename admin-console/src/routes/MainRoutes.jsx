import { lazy } from 'react';

import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

const PlatformOverviewPage = Loadable(lazy(() => import('pages/dashboard/platform-overview')));
const PlatformStationsPage = Loadable(lazy(() => import('pages/platform/stations')));
const PlatformNetworkPage = Loadable(lazy(() => import('pages/platform/network')));
const PlatformRulesPage = Loadable(lazy(() => import('pages/platform/rules')));
const PlatformAuditPage = Loadable(lazy(() => import('pages/platform/audit')));

const StationDashboardPage = Loadable(lazy(() => import('pages/station/dashboard')));
const StationInboundPage = Loadable(lazy(() => import('pages/station/inbound')));
const StationInboundFlightsPage = Loadable(lazy(() => import('pages/station/inbound-flights')));
const StationInboundWaybillsPage = Loadable(lazy(() => import('pages/station/inbound-waybills')));
const StationOutboundPage = Loadable(lazy(() => import('pages/station/outbound')));
const StationOutboundFlightsPage = Loadable(lazy(() => import('pages/station/outbound-flights')));
const StationOutboundWaybillsPage = Loadable(lazy(() => import('pages/station/outbound-waybills')));
const StationFilesPage = Loadable(lazy(() => import('pages/station/files')));
const StationExceptionsPage = Loadable(lazy(() => import('pages/station/exceptions')));

const MainRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        {
          path: 'sample-page',
          element: <PlatformOverviewPage />
        },
        {
          path: 'dashboard',
          children: [
            {
              path: 'platform-overview',
              element: <PlatformOverviewPage />
            }
          ]
        },
        {
          path: 'platform',
          children: [
            {
              path: 'stations',
              element: <PlatformStationsPage />
            },
            {
              path: 'network',
              element: <PlatformNetworkPage />
            },
            {
              path: 'rules',
              element: <PlatformRulesPage />
            },
            {
              path: 'audit',
              element: <PlatformAuditPage />
            }
          ]
        },
        {
          path: 'station',
          children: [
            {
              path: 'dashboard',
              element: <StationDashboardPage />
            },
            {
              path: 'inbound',
              children: [
                {
                  index: true,
                  element: <StationInboundPage />
                },
                {
                  path: 'flights',
                  element: <StationInboundFlightsPage />
                },
                {
                  path: 'waybills',
                  element: <StationInboundWaybillsPage />
                }
              ]
            },
            {
              path: 'outbound',
              children: [
                {
                  index: true,
                  element: <StationOutboundPage />
                },
                {
                  path: 'flights',
                  element: <StationOutboundFlightsPage />
                },
                {
                  path: 'waybills',
                  element: <StationOutboundWaybillsPage />
                }
              ]
            },
            {
              path: 'files',
              element: <StationFilesPage />
            },
            {
              path: 'exceptions',
              element: <StationExceptionsPage />
            }
          ]
        }
      ]
    }
  ]
};

export default MainRoutes;
