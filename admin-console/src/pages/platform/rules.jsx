import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import DownOutlined from '@ant-design/icons/DownOutlined';

import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { evidencePolicyRows, getGateEvaluationsByGateId, hardGatePolicyRows, ruleOverviewRows, ruleTemplateRows, scenarioTimelineRows } from 'data/sinoport-adapters';
import { exceptionTaxonomy, interfaceStatus } from 'data/sinoport';

export default function PlatformRulesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Rules & Instruction Engine"
          title="规则与指令引擎"
          description="规则与指令引擎统一维护服务等级、硬门槛、任务生成规则、证据要求和标准场景编排，确保平台与货站遵循同一状态机逻辑。"
          chips={['P1/P2/P3', 'Hard Gates', 'Task Templates', 'Evidence Policy', 'Scenario Timeline']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                标准场景
              </Button>
              <Button component={RouterLink} to="/platform/master-data/relationships" variant="outlined">
                对象关系
              </Button>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                审计与可信留痕
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="服务等级">
          <List disablePadding>
            {ruleOverviewRows.map((item) => (
              <ListItem key={item.level} divider>
                <ListItemText primary={`${item.level} · ${item.summary}`} secondary={item.rules} />
              </ListItem>
            ))}
          </List>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="硬门槛规则">
          <Stack sx={{ gap: 1.5 }}>
            {hardGatePolicyRows.map((rule) => (
              <Accordion key={rule.id} disableGutters>
                <AccordionSummary expandIcon={<DownOutlined />}>
                  <Stack sx={{ gap: 0.25 }}>
                    <Typography variant="caption" color="primary.main">
                      {rule.id}
                    </Typography>
                    <Typography variant="subtitle2">{rule.rule}</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack sx={{ gap: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">
                      触发节点：{rule.triggerNode}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      影响模块：{rule.affectedModule}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      阻断结果：{rule.blocker}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      恢复动作：{rule.recovery}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      放行角色：{rule.releaseRole}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      当前 demo 命中 {getGateEvaluationsByGateId(rule.id).length} 处对象或任务。
                    </Typography>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="任务生成规则">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>规则模板</TableCell>
                <TableCell>触发条件</TableCell>
                <TableCell>输出任务</TableCell>
                <TableCell>Owner</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ruleTemplateRows.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.trigger}</TableCell>
                  <TableCell>{item.output}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="异常字典">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>异常类型</TableCell>
                <TableCell>责任 Owner</TableCell>
                <TableCell>目标时限</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptionTaxonomy.map((item) => (
                <TableRow key={item.type} hover>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="证据要求">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>节点</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>证据要求</TableCell>
                <TableCell>阻断规则</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {evidencePolicyRows.map((item) => (
                <TableRow key={item.node} hover>
                  <TableCell>{item.node}</TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell>{item.evidence}</TableCell>
                  <TableCell>{item.blocker}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title="接口治理">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>接口</TableCell>
                <TableCell>方式</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>最近同步</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interfaceStatus.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.method}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.sync}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="标准场景编排">
          <LifecycleStepList steps={scenarioTimelineRows.map((item, index) => ({ ...item, progress: Math.max(18, 100 - index * 20) }))} />
        </MainCard>
      </Grid>
    </Grid>
  );
}
