/**
 * AresVision 中文语言包
 * 按模块/页面分组，key 命名遵循 module.section.item 层级
 */
const zh = {
  nav: {
    home: '首页',
    overview: '数据总览',
    explore: '数据探索',
    predict: '预测分析',
    ai: 'AI 解读',
    about: '关于',
    subtitle: '智绘赤星',
  },

  footer: {
    copyright: '© 2025 AresVision 智绘赤星 · 上海大学生计算机能力大赛',
    powered: 'POWERED BY OPENMARS · MCD 6.1 · PREDRNNV2',
  },

  common: {
    loading: '加载中...',
    loadingGlobe: '加载全球数据...',
    noData: '暂无数据',
    error: '加载失败',
    retry: '重试',
    marsYear: '火星年',
    play: 'PLAY',
    pause: 'PAUSE',
    season: {
      spring: '北半球春 / 南半球秋',
      summer: '北半球夏 / 南半球冬',
      autumn: '北半球秋 / 南半球春',
      winter: '北半球冬 / 南半球夏',
    },
    seasonMark: {
      summer: '夏至',
      autumn: '秋分',
      winter: '冬至',
    },
    // 纬度区域描述（动态）
    latRegion: {
      n90: ({ lat }) => `北极区(${lat}°N)`,
      n60: ({ lat }) => `中纬北(${lat}°N)`,
      eq:  ({ lat }) => `赤道区(${lat}°)`,
      s60: ({ lat }) => `中纬南(${lat}°S)`,
      s90: ({ lat }) => `南极区(${lat}°S)`,
    },
    positive: '正相关',
    negative: '负相关',
  },

  settings: {
    title: '偏好设置',
    titleEn: 'PREFERENCES',
    autoSave: '设置实时生效 · 自动保存',
    reset: '重置默认',
    resetConfirm: '重置所有偏好设置为默认值？',
    language: {
      label: 'LANGUAGE / 语言',
      zh: '中文', zhSub: 'Chinese',
      en: 'English', enSub: '英文',
    },
    theme: {
      label: 'THEME / 主题',
      dark: '深色模式', darkSub: 'Dark',
      light: '浅色模式', lightSub: 'Light',
      note: '浅色主题已启用，部分图表组件色彩仍针对深色优化',
    },
    colormap: {
      label: 'COLORMAP / 色彩映射',
      desc: '影响所有热力图与预测场可视化',
      notes: {
        inferno: '默认',
        viridis: '感知均匀',
        plasma: '感知均匀',
        magma: '高对比',
        cividis: '色觉友好',
        jet: '经典彩虹',
        rdbu: '适合残差',
      },
    },
    units: {
      label: 'UNITS / 单位制',
      ozone: '臭氧浓度',
      temperature: '温度',
      wind: '风速',
      pressure: '气压',
    },
    precision: {
      label: 'PRECISION / 数据精度',
      desc: '影响图表 Tooltip、指标数值的小数位数',
      opt2: '2 位',
      opt4: '4 位',
      opt6: '6 位',
      optFull: '完整',
    },
    export: {
      label: 'EXPORT / 导出偏好',
      desc: '作为导出时的默认值，可在导出对话框中临时修改',
      format: '默认格式',
      dpi: '分辨率 (DPI)',
      fontSize: '坐标轴字号',
      includeTitle: '导出图表包含标题',
      png: 'PNG', pngSub: '位图',
      svg: 'SVG', svgSub: '矢量',
      pdf: 'PDF', pdfSub: '文档',
      dpi150Sub: '标准', dpi300Sub: '出版', dpi600Sub: '超清',
    },
  },

  home: {
    subtitle: '智 绘 赤 星',
    desc: '基于 PredRNNv2 深度学习框架的火星臭氧柱浓度预测与可视化系统',
    descEn: 'Mars Ozone Column Prediction & Visualization — Powered by OpenMARS & MCD 6.1',
    exploreBtn: '开始探索',
    predictBtn: '预测分析 →',
    features: {
      viz3d:   { title: '3D 可视化', desc: 'WebGL 火星球体实时渲染' },
      ai:      { title: 'AI 预测',   desc: 'PredRNNv2 时空序列模型' },
      chart:   { title: '科学图表', desc: 'Ls-纬度热力图 & 多维分析' },
      insight: { title: '智能解读', desc: '大模型驱动的自然语言问答' },
    },
  },

  overview: {
    menuItems: {
      globe3d:      '三维球体 3D GLOBE',
      seasonal:     'Ls-纬度臭氧热力图',
      correlation:  '关联矩阵 CORRELATION',
      realtime:     '实时监控 REALTIME',
      environment:  '环境参数 ENVIRONMENT',
      prediction:   '预测引擎 PREDICTION',
      distribution: '数据分布 DISTRIBUTION',
    },
    controls: {
      marsYear: '火星年 Mars Year',
      startLs: '起始 Ls',
      autoRotate: '开启自动旋转',
      gesture: 'AI 手势控制',
      loadingData: '加载数据中...',
      interactionHint: '• 拖拽：旋转火星球体\n• 滚轮：缩放视图\n• 点击数据点：查看详情\n• ▶ PLAY：播放时序动画',
      dataPoints: '数据点',
      maxVal: '最大值',
      cameraTracking: '摄像头追踪中... 单手拖拽 / 双手缩放',
      resetLs: '重置到 Ls=0°',
    },
    charts: {
      heatmapTitle: ({ year }) => `MY ${year} 臭氧时空分布热力图 (Zonal Mean O₃)`,
      noData: '暂无数据 NO DATA',
      unknownType: '未知图表类型',
      currentValue: '当前数值',
      ozoneDist: '臭氧柱浓度分布统计',
      realtimeResult: '实时预测结果',
      processingProgress: '处理进度',
      engineTitle: 'PredRNNv2 时空预测引擎',
      inputChannels: '输入通道',
      timeWindow: '时间窗口',
      spatialGrid: '空间网格',
    },
    env: {
      temperature: '温度',
      pressure: '压力',
      dust: '尘埃',
      wind: '风速',
    },
  },

  explore: {
    title: '数据探索',
    subtitle: 'DATA EXPLORATION',
    ozoneMap: 'OZONE MAP · 全球臭氧分布',
    heatmapTitle: 'SEASONAL HEATMAP · Ls-纬度臭氧热力图',
    heatmapSub: ({ year }) => `O₃ Column Density (zonal mean) · MY${year}`,
    bandsTitle: 'LATITUDE BANDS · 纬度带季节变化',
    corrTitle: 'CORRELATION MATRIX · 变量相关性矩阵',
    corrSub: ({ year }) => `Pearson Correlation · O₃ vs Environmental Variables · MY${year}`,
    // 动态 Insight 模板
    heatmapInsight: ({ year, latMaxDesc, lsMax, valMax, latMinDesc, lsMin, valMin, ratio, unit }) =>
      `本图展示了 MY${year} 全年臭氧柱浓度的纬度-季节分布。` +
      `${latMaxDesc}在 Ls≈${lsMax}° 附近达到峰值 ${valMax} ${unit}，` +
      `${latMinDesc}在 Ls≈${lsMin}° 时降至最低 ${valMin} ${unit}。` +
      `极地与赤道浓度比约为 ${ratio}:1。`,
    bandsInsight: ({ maxBandName, maxAmp, minBandName, minAmp, phaseDiff, unit }) =>
      `五个纬度带的季节曲线显示：${maxBandName} 振幅最大（峰谷差 ${maxAmp} ${unit}），` +
      `${minBandName} 最为平稳（振幅 ${minAmp} ${unit}）。` +
      `南北极峰值存在约 ${phaseDiff}° 的 Ls 相位差。`,
    corrInsight: ({ year, varName, corrVal, corrSign }) =>
      `Pearson 相关分析（MY${year}）：臭氧柱浓度与环境变量中，` +
      `${varName} 的相关性最强（r=${corrVal}，${corrSign}）。` +
      `矩阵基于全球空间均值时间序列计算，揭示了各变量在行星尺度上的协变关系。`,
  },

  predict: {
    title: '预测分析',
    subtitle: 'PREDICTION & ANALYSIS',
    runBtn: '🚀 开始预测 RUN PREDICT',
    runningBtn: '预测中...',
    horizon: '预测步长 Horizon',
    marsYear: '火星年 Mars Year',
    startLs: '起始 Ls',
    lsMarks: {
      spring: '0° 春分',
      summer: '90° 夏至',
      autumn: '180° 秋分',
      winter: '270° 冬至',
    },
    envVarsLabel: '选择纳入 PredRNNv2 模型的环境驱动变量',
    envVarsNote: ({ selected }) => `O₃ 自回归通道始终启用 · 已选 ${selected}/6 环境变量`,
    variables: {
      Temperature:         '温度 Temperature',
      Dust_Optical_Depth:  '沙尘光学厚度 DOD',
      Solar_Flux_DN:       '太阳辐射通量',
      U_Wind:              '纬向风 U Wind',
      V_Wind:              '经向风 V Wind',
    },
    fileUpload: {
      drag: '拖拽 .nc 文件到此处',
      click: '或点击选择文件',
    },
    viewModes: {
      triptych:   '三联对比 Triptych',
      original:   '原始数据',
      prediction: '预测结果',
      diff:       '差值分析',
    },
    panels: {
      truth:      '原始真值 Ground Truth',
      prediction: '模型预测 Prediction',
      residual:   '差值场 Residual',
    },
    showStep: '显示预测步：',
    computing: '预测运算中...',
    clickToStart: '点击"开始预测"查看结果',
    errorPrefix: '预测请求失败，请检查后端服务是否启动',
    evalTitle: 'MODEL EVALUATION / 模型评估指标',
    perStepTitle: '逐步指标 Per-Step Metrics',
    perfTitle: 'TEST SET PERFORMANCE / 测试集性能分析表',
    generateBtn: '生成全样本性能表 GENERATE',
    generatingBtn: '指标计算中...',
    avgR2: '平均决定系数 AVG R²',
    shapleyTitle: 'FEATURE IMPORTANCE / 边际贡献分析',
    shapleyDesc: '基于博弈论 Shapley 值，计算加入各气象特征对模型整体预测性能的提升边际贡献度',
    shapleyGenerateBtn: '分析特征贡献 ANALYZE',
    shapleyGeneratingBtn: '分析中...',
    toggleShapley: '贡献度 SHAPLEY',
    globalR2:   '全局决定系数 GLOBAL R²',
    globalRMSE: '全局 RMSE',
    globalMAE:  '全局 MAE',
    globalSSIM: '全局 SSIM',
    tableHeaders: {
      my:   '火星年 MY',
      ls:   '太阳黄经 Ls',
      r2:   '决定系数 R² (Spatial)',
      rmse: 'RMSE',
      mae:  'MAE',
      ssim: 'SSIM',
    },
    generatingHint: '正在遍历测试集并计算模型评价指标，请稍候...',
    perfEmptyHint: '点击上方按钮，系统将自动汇总模型在测试集 (MY27 352° ~ MY28 69°) 上的预测精度数据',
    testSetNote: '* 注：测试集包含模型未学习过的 MY28 早期数据，真实反映了模型的泛化能力。',
    fallbackWarning: '注意：此预测使用了由于缺失而自动选择的回退模型',
    fallbackReason: '原因：',
    initPrompt: '配置参数并点击"开始预测"以运行 PredRNNv2 推理',
    initDesc: '模型将基于选定的 Ls 起始时刻，利用前 3 个时间步的多通道数据，\n预测后续最多 3 个时间步的火星全球臭氧柱浓度空间分布。',
    summary: ({ lsStart, year, horizon, varCount, varNames, rmse, ssim, r2 }) =>
      `<strong>预测完成</strong>：起始 Ls=${lsStart}°，MY${year}，共预测 ${horizon} 步。\n` +
      `输入变量：O₃ + ${varCount} 个环境变量${varCount > 0 ? `（${varNames}）` : '（仅 O₃ 自回归基线）'}。\n` +
      `模型整体表现：RMSE = ${rmse} μm-atm，空间结构相似度 SSIM = ${ssim}，决定系数 R² = ${r2}。`,
    summaryDone: '预测完成',
    summaryL1: ({ lsStart, year, horizon }) => `起始 Ls=${lsStart}°，MY${year}，共预测 ${horizon} 步。`,
    summaryL2a: ({ varCount }) => `输入变量：O₃ + ${varCount} 个环境变量`,
    summaryL2b: ({ varNames }) => `（${varNames}）`,
    summaryL2c: '（仅 O₃ 自回归基线）',
    summaryL3a: '模型整体表现：RMSE = ',
    summaryL3b: ' μm-atm，空间结构相似度 SSIM = ',
    summaryL3c: '，决定系数 R² = ',
    fullscreen3D: {
      truth:      '原始真值 Ground Truth',
      prediction: '模型预测 Prediction',
      residual:   '差值场 Residual',
    },
  },

  ai: {
    title: 'AI 智能解读',
    subtitle: 'AI-POWERED INSIGHT',
    chatHeader: 'CHAT — 智能问答',
    contextTitle: '当前分析上下文',
    quickTitle: '快捷问题',
    placeholder: '输入你的问题...',
    send: '发送',
    errorChart: '实时预测误差分布',
    quickQuestions: [
      '预测偏差最大的区域在哪？',
      '沙尘暴如何影响臭氧？',
      '为什么极地臭氧有季节峰值？',
      '模型在哪些季节表现最差？',
      '昼夜变化规律是什么？',
    ],
    welcome: '你好！我是 AresVision AI 助手，可以帮你解读火星臭氧预测结果。\n\n你可以问我：\n• 当前预测场中，哪些区域臭氧偏差最大？\n• 为什么极地在 Ls=200° 附近出现臭氧峰值？\n• 沙尘暴对臭氧分布有什么影响？',
  },

  about: {
    title: '关于项目',
    subtitle: 'ABOUT ARESVISION',
    description:
      '智绘赤星 (AresVision) 是一个面向火星大气科学研究的臭氧预测与可视化平台，' +
      '基于 OpenMARS 再分析数据和 MCD 6.1 气候模拟数据，运用 PredRNNv2 时空深度学习模型' +
      '实现火星全球臭氧柱浓度的多步预测。',
    techCats: {
      frontend: '前端',
      backend:  '后端',
      model:    '模型',
      data:     '数据',
    },
    openmarsTitle: 'OPENMARS 再分析数据',
    openmarsContent:
      '变量：o3col（臭氧柱浓度, μm-atm）\n' +
      '维度：Ls × lat(36) × lon(72) × lev(35)\n' +
      '覆盖：MY27 完整年 (Ls 2°–360°)\n' +
      '分辨率：5° 经纬网格',
    mcdTitle: 'MCD 6.1 气候模拟数据',
    mcdContent:
      '变量：U/V Wind, Pressure, Temperature, DOD, Solar Flux\n' +
      '维度：sol(669) × hour(8) × lat(36) × lon(72)\n' +
      '覆盖：MY27 完整 (5352 时间步)\n' +
      '时间对齐：Ls 插值到 OpenMARS 格点',
    teamRoles: ['全栈开发', '数据科学', 'UI/UX', '模型训练'],
    member: ({ n }) => `成员 ${n}`,
    competition: '上海大学生计算机能力大赛 · 大数据赛道',
  },

  auth: {
    loginTitle: '登录',
    registerTitle: '注册',
    loginTab: '登录',
    registerTab: '注册',
    email: '邮箱',
    emailPlaceholder: '请输入邮箱',
    username: '用户名',
    usernamePlaceholder: '请输入用户名',
    password: '密码',
    passwordPlaceholder: '请输入密码',
    newPassword: '新密码',
    newPasswordPlaceholder: '请输入新密码',
    confirmPassword: '确认密码',
    confirmPasswordPlaceholder: '请再次输入密码',
    loginBtn: '登录',
    registerBtn: '注册',
    loggingIn: '登录中...',
    registering: '注册中...',
    switchToRegister: '没有账号？立即注册',
    switchToLogin: '已有账号？返回登录',
    menuLogin: '登录 / 注册',
    menuLogout: '退出登录',
    menuAdmin: '管理面板',
    roleUser: '用户',
    roleAdmin: '管理员',
    changePassword: '修改密码',
    oldPassword: '旧密码',
    oldPasswordPlaceholder: '请输入旧密码',
    changePwdBtn: '确认修改',
    changePwdSuccess: '密码修改成功',
    errEmailRequired: '请输入邮箱',
    errPasswordRequired: '请输入密码',
    errUsernameRequired: '请输入用户名',
    errPasswordMismatch: '两次输入的密码不一致',
    errLoginFailed: '登录失败，请检查邮箱和密码',
    errRegisterFailed: '注册失败，请稍后重试',
    errChangePwdFailed: '密码修改失败',
    toastWelcome: ({ username }) => `欢迎回来，${username}`,
    toastRegistered: '注册成功，已自动登录',
    toastLoggedOut: '已退出登录',
    logoutConfirmTitle: '退出登录',
    logoutConfirmMsg: '确定要退出登录吗？',
    logoutConfirmBtn: '确认退出',
    cancelBtn: '取消',
  },
};

export default zh;
