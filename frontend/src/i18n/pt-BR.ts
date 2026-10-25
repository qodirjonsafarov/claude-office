import type { TranslationKey } from "./en";

const ptBR: Record<TranslationKey, string> = {
  // App
  "app.title": "Visualizador do Escritório",
  "app.subtitle": "QG da equipe de IA",
  "hud.agents": "Equipe",
  "hud.tasks": "Tarefas",
  "hud.tools": "Ferram.",
  "hud.context": "Contexto",
  "app.initializingSystems": "Inicializando Sistemas...",

  // Header Controls
  "header.simulate": "Simular",
  "header.reset": "Resetar",
  "header.clearDb": "Limpar BD",
  "header.debugOn": "Debug ligado",
  "header.debugOff": "Debug desligado",
  "header.settings": "Configurações",
  "header.help": "Ajuda",
  "header.status": "Status",
  "header.connected": "Conectado",
  "header.disconnected": "Desconectado",
  "header.aiOn": "LIGADO",
  "header.aiOff": "DESLIGADO",
  "header.agents": "agentes",
  "header.tour": "Tur",
  "header.more": "Mais",
  "header.moreMenu": "Mais ações",
  "help.tour": "Fazer o tour",

  // Command Center
  "commandCenter.zone.needsYou": "Precisa de você",
  "commandCenter.zone.working": "Trabalhando",
  "commandCenter.zone.done": "Concluído",
  "commandCenter.zone.ended": "Encerrado",

  // Modals
  "modal.confirmDbWipe": "Confirmar Limpeza do Banco",
  "modal.cancel": "Cancelar",
  "modal.wipeAllData": "Limpar Todos os Dados",
  "modal.wipeWarning":
    "Tem certeza que deseja excluir permanentemente todo o histórico de sessões e eventos? Esta ação não pode ser desfeita e vai resetar o estado atual do visualizador.",
  "modal.keyboardShortcuts": "Atalhos de Teclado",
  "modal.close": "Fechar",
  "modal.toggleDebug": "Alternar modo debug",
  "modal.showAgentPaths": "Mostrar caminhos dos agentes",
  "modal.showQueueSlots": "Mostrar slots da fila",
  "modal.showPhaseLabels": "Mostrar rótulos de fase",
  "modal.deleteSession": "Excluir Sessão",
  "modal.delete": "Excluir",
  "modal.deleteSessionConfirm": "Tem certeza que deseja excluir a sessão",
  "modal.deleteSessionWarning": "Isso vai remover permanentemente",
  "modal.events": "eventos",
  "modal.cannotBeUndone": "Esta ação não pode ser desfeita.",

  // Settings
  "settings.title": "Configurações",
  "settings.clockType": "Tipo de Relógio",
  "settings.analog": "Analógico",
  "settings.digital": "Digital",
  "settings.timeFormat": "Formato de Hora",
  "settings.12hour": "12 horas",
  "settings.24hour": "24 horas",
  "settings.sessionBehavior": "Comportamento de Sessão",
  "settings.autoFollow": "Seguir novas sessões automaticamente",
  "settings.autoFollowDesc":
    "Alternar automaticamente para novas sessões no projeto atual",
  "settings.clockTip":
    "Dica: Clique no relógio do escritório para alternar rapidamente entre os modos.",
  "settings.language": "Idioma",

  // Sessions
  "sessions.title": "Sessões",
  "sessions.loading": "Carregando sessões...",
  "sessions.noSessions": "Nenhuma sessão encontrada",
  "sessions.unknownProject": "Projeto Desconhecido",
  "sessions.deleteSession": "Excluir sessão",
  "sessions.events": "eventos",
  "sessions.events_one": "{count} evento",
  "sessions.events_other": "{count} eventos",
  "sessions.expandSidebar": "Expandir barra lateral",
  "sessions.collapseSidebar": "Recolher barra lateral",
  "sessions.dragToResize": "Arraste para redimensionar",

  // Right Sidebar
  "sidebar.events": "Eventos",
  "sidebar.conversation": "Conversa",

  // Event Log
  "eventLog.title": "Log de Eventos",
  "eventLog.events": "eventos",
  "eventLog.events_one": "{count} evento",
  "eventLog.events_other": "{count} eventos",
  "eventLog.waiting": "Aguardando eventos...",

  // Agent Status
  "agentStatus.title": "Estado dos Agentes",
  "agentStatus.agents": "agentes",
  "agentStatus.agents_one": "{count} agente",
  "agentStatus.agents_other": "{count} agentes",
  "agentStatus.noAgents": "Sem agentes",
  "agentStatus.agent": "Agente",
  "agentStatus.desk": "Mesa",
  "agentStatus.noTaskSummary": "Sem resumo de tarefa",
  "agentStatus.noRecentToolCall": "Sem chamada de ferramenta recente",
  "agentStatus.inQueue": "Na fila {queueType} (posição {position})",

  // Git Status
  "git.title": "Status do Git",
  "git.waitingForStatus": "Aguardando status do git...",
  "git.noSession": "Nenhuma sessão selecionada",
  "git.noRepo": "Nenhum repositório git detectado",
  "git.changedFiles": "Arquivos Alterados",
  "git.staged": "preparado",
  "git.recentCommits": "Commits Recentes",
  "git.noCommits": "Nenhum commit encontrado",
  "git.modified": "modificado",
  "git.added": "adicionado",
  "git.deleted": "excluído",
  "git.renamed": "renomeado",
  "git.copied": "copiado",
  "git.untracked": "não rastreado",
  "git.ignored": "ignorado",

  // Conversation
  "conversation.title": "Conversa",
  "conversation.msgs": "msgs",
  "conversation.msgs_one": "{count} msg",
  "conversation.msgs_other": "{count} msgs",
  "conversation.thinking": "Pensando",
  "conversation.showMore": "Mostrar mais",
  "conversation.collapse": "Recolher",
  "conversation.claude": "Claude",
  "conversation.showFullResponse": "Mostrar resposta completa",
  "conversation.hideToolCalls": "Ocultar chamadas de ferramentas",
  "conversation.showToolCalls": "Mostrar chamadas de ferramentas",
  "conversation.expandConversation": "Expandir conversa",
  "conversation.close": "Fechar",
  "conversation.noConversation":
    "Sem conversa ainda. Inicie uma sessão do Claude Code.",

  // Event Detail Modal
  "eventDetail.summary": "Resumo",
  "eventDetail.tool": "Ferramenta",
  "eventDetail.agentName": "Nome do Agente",
  "eventDetail.taskDescription": "Descrição da Tarefa",
  "eventDetail.userPrompt": "Prompt do Usuário",
  "eventDetail.thinking": "Pensamento",
  "eventDetail.message": "Mensagem",
  "eventDetail.resultSummary": "Resumo do Resultado",
  "eventDetail.errorType": "Tipo de Erro",
  "eventDetail.toolInput": "Entrada da Ferramenta",
  "eventDetail.noDetail":
    "Nenhum detalhe adicional disponível para este evento.",

  // Loading Screen
  "loading.office": "Carregando escritório...",

  // Zoom Controls
  "zoom.in": "Aumentar zoom",
  "zoom.out": "Diminuir zoom",
  "zoom.reset": "Resetar zoom",

  // Mobile
  "mobile.menu": "Menu",
  "mobile.agentActivity": "Atividade dos Agentes",
  "mobile.boss": "Chefe",
  "mobile.noActiveAgents": "Sem agentes ativos",
  "mobile.office": "Escritório",
  "mobile.events": "Eventos",
  "mobile.sessions": "Sessões",
  "mobile.more": "Mais",
  "mobile.workingNow": "{count} trabalhando",
  "mobile.allIdle": "Tudo calmo",
  "mobile.actions": "Ações",
  "mobile.working": "trabalhando",
  "mobile.idle": "livre",

  // Status Messages
  "status.switchedToSession": "Mudou para sessão {sessionId}...",
  "status.deletingSession": "Excluindo sessão {sessionId}...",
  "status.sessionDeleted": "Sessão excluída.",
  "status.failedDeleteSession": "Falha ao excluir sessão.",
  "status.errorConnecting": "Erro ao conectar ao backend.",
  "status.sessionRenamed": "Sessão renomeada.",
  "status.failedRenameSession": "Falha ao renomear sessão.",
  "status.clearingDatabase": "Limpando banco de dados...",
  "status.databaseCleared": "Banco de dados limpo.",
  "status.failedClearDatabase": "Falha ao limpar banco de dados.",
  "status.triggeringSimulation": "Iniciando simulação...",
  "status.simulationStarted": "Simulação iniciada!",
  "status.failedSimulation": "Falha ao iniciar simulação.",
  "status.storeReset": "Estado resetado.",
  "status.sessionDeletedSwitched": "Sessão excluída. Mudou para {sessionName}",
  "status.sessionDeletedNoOthers":
    "Sessão excluída. Nenhuma outra sessão disponível.",
  "status.connectedTo": "Conectado a {sessionName}",
  "status.autoFollowed": "Seguindo nova sessão: {sessionName}",

  // Navigation
  "navigation.building": "Edifício",

  // Tour
  "tour.steps.singleWelcome.title": "Bem-vindo ao Claude Office",
  "tour.steps.singleWelcome.description":
    "Este escritório em pixel art mostra suas sessões do Claude Code em tempo real. Vamos dar uma olhada rápida.",
  "tour.steps.simulate.title": "Iniciar Simulação",
  "tour.steps.simulate.description":
    "Clique em Simular para dar vida ao escritório.",
  "tour.steps.agentsArrive.title": "Agentes Chegam",
  "tour.steps.agentsArrive.description":
    "Agentes chegam pelo elevador, caminham até suas mesas e começam a trabalhar.",
  "tour.steps.inspectAgent.title": "Inspecione um Agente",
  "tour.steps.inspectAgent.description":
    "Clique em qualquer personagem para inspecioná-lo.",
  "tour.steps.focusPopup.title": "Popup de Foco",
  "tour.steps.focusPopup.description":
    "Daqui você pode copiar uma mensagem para a área de transferência e ir para o terminal. O escritório atualiza em tempo real enquanto o Claude trabalha.",
  "tour.steps.settings.title": "Configurar Andares",
  "tour.steps.settings.description":
    "Abra Configurações para adicionar andares e mapear pastas de projetos para uma visão de edifício multi-andar.",
  "tour.skip": "Pular tour",
  "tour.next": "Próximo",

  // Attention System
  "attention.toast.permissionRequest": "{agentName} precisa de permissão",
  "attention.toast.taskCompleted": "{agentName} completou uma tarefa",
  "attention.toast.error": "{agentName} encontrou um erro",
  "attention.toast.agentArrived": "{agentName} entrou no escritório",
  "attention.toast.stop": "{agentName} parou",
  "attention.toast.backgroundTask": "{agentName}: {taskDescription}",
  "attention.commandBar.placeholder": "Digite um comando...",
  "attention.commandBar.focusAgent": "Focar Agente: {name}",
  "attention.commandBar.focusBoss": "Focar Terminal do Chefe",
  "attention.commandBar.showAttention": "Mostrar Fila de Atenção",
  "attention.commandBar.dismissAll": "Descartar Todas as Notificações",
  "attention.commandBar.toggleDebug": "Alternar Depuração",
  "attention.commandBar.togglePaths": "Alternar Exibição de Caminhos",
  "attention.commandBar.toggleQueueSlots": "Alternar Slots de Fila",
  "attention.commandBar.togglePhaseLabels": "Alternar Rótulos de Fase",
  "attention.commandBar.toggleObstacles": "Alternar Obstáculos",
  "attention.commandBar.noResults": "Nenhum comando encontrado",
  "attention.popup.focusTerminal": "Focar Terminal",
  "attention.popup.close": "Fechar",
  "attention.popup.state": "Estado",
  "attention.popup.task": "Tarefa",
  "attention.popup.type": "Tipo",
  "attention.popup.desk": "Mesa",
  "attention.popup.boss": "Chefe",
  "attention.popup.agent": "Agente",
  "settings.commandBar": "Barra de Comandos (⌘K)",
  "settings.clickToFocus": "Clique para Focar",
  "settings.toastFilters": "Notificações Toast",
  "settings.toastAutoDismiss": "Tempo de Auto-descarte",
  "settings.filterPermission": "Pedidos de permissão",
  "settings.filterError": "Erros",
  "settings.filterTaskComplete": "Concluído e tarefas concluídas",
  "settings.filterArrival": "Chegadas de agentes",
  "auth.title": "Cole o token de acesso",
  "auth.hint":
    "O servidor recusou este navegador. Cole o token ou o link ?token= do console do servidor.",
  "auth.placeholder": "Token ou link de início",
  "auth.connect": "Conectar",
  "team.title": "Equipe agora",
  "team.tools": "ferramentas",
  "team.tools_one": "{count} ferramenta",
  "team.tools_other": "{count} ferramentas",
  "team.needsYou": "Precisa de você",
  "team.progress": "Progresso",
  "eventLog.search": "Buscar eventos",
  "eventLog.filters": "Filtros de eventos",
  "eventLog.all": "Todos",
  "eventLog.kindTools": "Ferramentas",
  "eventLog.kindErrors": "Erros",
  "eventLog.kindPermissions": "Permissões",
  "eventLog.noMatches": "Nenhum evento corresponde",
  "eventLog.clearFilters": "Limpar filtros",
  "hud.tokens": "Tokens",
};

export default ptBR;
