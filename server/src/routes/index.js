'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const storyRoutes = require('./story.routes');
const playRoutes = require('./play.routes');
const saveRoutes = require('./save.routes');
const meRoutes = require('./me.routes');
const healthRoutes = require('./health.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/story', storyRoutes);
router.use('/play', playRoutes);
router.use('/saves', saveRoutes);
router.use('/me', meRoutes);

module.exports = { router, healthRoutes };
