/**
 * Play Command
 *
 * Turns the Glass icon into a bouncy ball with physics!
 * Throw it around, watch it bounce with gravity.
 * Run the command again to stop playing.
 *
 * Usage: play
 * Example: play
 */

(function() {
  // Physics state - exposed globally so floating-icon can check it
  let isPlaying = false;
  
  // Expose play mode state globally
  window.GlassPlayMode = {
    isActive: function() { return isPlaying; }
  };
  let animationId = null;
  let velocity = { x: 0, y: 0 };
  let position = { x: 0, y: 0 };
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };
  let lastMouseTime = 0;
  let dragVelocities = [];

  // Physics constants
  const GRAVITY = 0.5;
  const BOUNCE_DAMPENING = 0.7;
  const AIR_RESISTANCE = 0.99;
  const VELOCITY_THRESHOLD = 0.1;
  const MAX_VELOCITY = 30;

  // Get the glass icon element
  function getIconElement() {
    return document.getElementById('glass-ui');
  }

  // Sphere size constant (matches floating-icon.js CIRCLE_SIZE)
  const SPHERE_SIZE = 58;

  // Get icon dimensions - always use sphere size in play mode
  function getIconSize() {
    // In play mode, we always treat it as a sphere
    return { width: SPHERE_SIZE, height: SPHERE_SIZE };
  }

  // Get current position from transform or style
  function getCurrentPosition() {
    const icon = getIconElement();
    if (!icon) return { x: 0, y: 0 };
    
    const rect = icon.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  // Set position using left/top
  function setPosition(x, y) {
    const icon = getIconElement();
    if (!icon) return;
    
    icon.style.right = 'auto';
    icon.style.left = x + 'px';
    icon.style.top = y + 'px';
  }

  // Physics update loop
  function physicsLoop() {
    if (!isPlaying || isDragging) {
      animationId = requestAnimationFrame(physicsLoop);
      return;
    }

    const icon = getIconElement();
    if (!icon) {
      stopPlaying();
      return;
    }

    const size = getIconSize();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Apply gravity
    velocity.y += GRAVITY;

    // Apply air resistance
    velocity.x *= AIR_RESISTANCE;
    velocity.y *= AIR_RESISTANCE;

    // Clamp velocity
    velocity.x = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.x));
    velocity.y = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.y));

    // Update position
    position.x += velocity.x;
    position.y += velocity.y;

    // Bounce off walls
    // Left wall
    if (position.x < 0) {
      position.x = 0;
      velocity.x = -velocity.x * BOUNCE_DAMPENING;
      addBounceEffect();
    }
    // Right wall
    if (position.x + size.width > screenWidth) {
      position.x = screenWidth - size.width;
      velocity.x = -velocity.x * BOUNCE_DAMPENING;
      addBounceEffect();
    }
    // Top wall
    if (position.y < 0) {
      position.y = 0;
      velocity.y = -velocity.y * BOUNCE_DAMPENING;
      addBounceEffect();
    }
    // Bottom wall (floor)
    if (position.y + size.height > screenHeight) {
      position.y = screenHeight - size.height;
      velocity.y = -velocity.y * BOUNCE_DAMPENING;
      
      // Extra friction on floor
      velocity.x *= 0.95;
      
      // Stop tiny bounces
      if (Math.abs(velocity.y) < 2) {
        velocity.y = 0;
      }
      
      addBounceEffect();
    }

    // Stop if velocity is very low and on floor
    if (Math.abs(velocity.x) < VELOCITY_THRESHOLD && 
        Math.abs(velocity.y) < VELOCITY_THRESHOLD &&
        position.y + size.height >= screenHeight - 1) {
      velocity.x = 0;
      velocity.y = 0;
    }

    // Apply position
    setPosition(position.x, position.y);

    // Add slight rotation based on horizontal velocity
    const rotation = velocity.x * 2;
    icon.style.transform = `rotate(${rotation}deg)`;

    animationId = requestAnimationFrame(physicsLoop);
  }

  // Visual bounce effect
  function addBounceEffect() {
    const icon = getIconElement();
    if (!icon) return;

    const mainCircle = icon.querySelector('.glass-main');
    if (mainCircle) {
      mainCircle.style.transform = 'scale(0.95)';
      setTimeout(() => {
        mainCircle.style.transform = 'scale(1)';
      }, 100);
    }
  }

  // Check if event is on the icon
  function isEventOnIcon(e) {
    const icon = getIconElement();
    if (!icon) return false;
    
    const rect = icon.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // Mouse/touch handlers for throwing
  function handleMouseDown(e) {
    if (!isPlaying) return;
    if (!isEventOnIcon(e)) return;
    
    // Stop event from reaching the normal drag handlers
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    isDragging = true;
    dragVelocities = [];
    lastMousePos = { x: e.clientX, y: e.clientY };
    lastMouseTime = Date.now();
    
    // Stop current motion
    velocity = { x: 0, y: 0 };
    
    const icon = getIconElement();
    if (icon) {
      icon.style.transform = 'rotate(0deg)';
      icon.classList.add('glass-grabbing');
    }
  }

  function handleMouseMove(e) {
    if (!isPlaying || !isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const now = Date.now();
    const dt = now - lastMouseTime;
    
    if (dt > 0) {
      const vx = (e.clientX - lastMousePos.x) / dt * 16; // Scale to 60fps
      const vy = (e.clientY - lastMousePos.y) / dt * 16;
      
      // Store recent velocities for averaging
      dragVelocities.push({ x: vx, y: vy, time: now });
      
      // Keep only last 5 samples
      if (dragVelocities.length > 5) {
        dragVelocities.shift();
      }
    }
    
    // Update position while dragging
    const size = getIconSize();
    position.x = e.clientX - size.width / 2;
    position.y = e.clientY - size.height / 2;
    setPosition(position.x, position.y);
    
    lastMousePos = { x: e.clientX, y: e.clientY };
    lastMouseTime = now;
  }

  function handleMouseUp(e) {
    if (!isPlaying || !isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = false;
    
    const icon = getIconElement();
    if (icon) {
      icon.classList.remove('glass-grabbing');
    }
    
    // Calculate throw velocity from recent samples
    if (dragVelocities.length > 0) {
      const recentVelocities = dragVelocities.filter(v => Date.now() - v.time < 150);
      
      if (recentVelocities.length > 0) {
        let avgVx = 0, avgVy = 0;
        recentVelocities.forEach(v => {
          avgVx += v.x;
          avgVy += v.y;
        });
        avgVx /= recentVelocities.length;
        avgVy /= recentVelocities.length;
        
        // Apply throw velocity with multiplier for fun
        velocity.x = avgVx * 2;
        velocity.y = avgVy * 2;
        
        // Clamp
        velocity.x = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.x));
        velocity.y = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.y));
      }
    }
    
    dragVelocities = [];
  }

  // Bound handlers for cleanup
  let boundIconMouseDown = null;
  let boundDocMouseMove = null;
  let boundDocMouseUp = null;
  let boundIconTouchStart = null;
  let boundDocTouchMove = null;
  let boundDocTouchEnd = null;

  // Start physics mode
  function startPlaying() {
    isPlaying = true;
    
    // Get current position
    const pos = getCurrentPosition();
    position = { x: pos.x, y: pos.y };
    velocity = { x: 0, y: 0 };
    
    const icon = getIconElement();
    if (!icon) return;
    
    // Make sure CLI is closed so we're in sphere mode
    if (window.GlassUI && window.GlassUI.isVisible && window.GlassUI.isVisible()) {
      window.GlassUI.hide();
    }
    // Also remove 'active' class to ensure sphere mode
    icon.classList.remove('active');
    
    // Add play mode class
    icon.classList.add('glass-playing');
    
    // Track if we actually moved (for click detection)
    let hasMoved = false;
    let mouseDownPos = { x: 0, y: 0 };
    
    // Create bound handlers
    boundIconMouseDown = function(e) {
      // Only left-click
      if (e.button !== 0) return;
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      isDragging = true;
      hasMoved = false;
      dragVelocities = [];
      lastMousePos = { x: e.clientX, y: e.clientY };
      mouseDownPos = { x: e.clientX, y: e.clientY };
      lastMouseTime = Date.now();
      velocity = { x: 0, y: 0 };
      
      // Center ball on cursor immediately
      const size = getIconSize();
      position.x = e.clientX - size.width / 2;
      position.y = e.clientY - size.height / 2;
      setPosition(position.x, position.y);
      
      icon.style.transform = 'rotate(0deg)';
      icon.classList.add('glass-grabbing');
    };
    
    boundDocMouseMove = function(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Check if we've moved enough to count as a drag (not a click)
      const dx = e.clientX - mouseDownPos.x;
      const dy = e.clientY - mouseDownPos.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
      }
      
      const now = Date.now();
      const dt = now - lastMouseTime;
      
      if (dt > 0) {
        const vx = (e.clientX - lastMousePos.x) / dt * 16;
        const vy = (e.clientY - lastMousePos.y) / dt * 16;
        dragVelocities.push({ x: vx, y: vy, time: now });
        if (dragVelocities.length > 5) dragVelocities.shift();
      }
      
      const size = getIconSize();
      position.x = e.clientX - size.width / 2;
      position.y = e.clientY - size.height / 2;
      setPosition(position.x, position.y);
      
      lastMousePos = { x: e.clientX, y: e.clientY };
      lastMouseTime = now;
    };
    
    boundDocMouseUp = function(e) {
      if (!isDragging) return;
      
      isDragging = false;
      icon.classList.remove('glass-grabbing');
      
      // If it was a click (not a drag), open the CLI
      if (!hasMoved) {
        // Toggle the CLI so user can type 'play' to stop
        if (window.GlassUI) {
          window.GlassUI.toggle();
        }
        dragVelocities = [];
        return;
      }
      
      const recentVelocities = dragVelocities.filter(v => Date.now() - v.time < 150);
      if (recentVelocities.length > 0) {
        let avgVx = 0, avgVy = 0;
        recentVelocities.forEach(v => { avgVx += v.x; avgVy += v.y; });
        avgVx /= recentVelocities.length;
        avgVy /= recentVelocities.length;
        
        velocity.x = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, avgVx * 2));
        velocity.y = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, avgVy * 2));
      }
      dragVelocities = [];
    };
    
    // Touch handlers
    boundIconTouchStart = function(e) {
      const touch = e.touches[0];
      boundIconMouseDown({ 
        clientX: touch.clientX, 
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        stopImmediatePropagation: () => e.stopImmediatePropagation()
      });
    };
    
    boundDocTouchMove = function(e) {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      boundDocMouseMove({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
    };
    
    boundDocTouchEnd = function(e) {
      boundDocMouseUp({});
    };
    
    // Add event listeners directly to icon and document
    icon.addEventListener('mousedown', boundIconMouseDown, true);
    document.addEventListener('mousemove', boundDocMouseMove, true);
    document.addEventListener('mouseup', boundDocMouseUp, true);
    
    icon.addEventListener('touchstart', boundIconTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', boundDocTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', boundDocTouchEnd, true);
    
    // Start physics loop
    animationId = requestAnimationFrame(physicsLoop);
  }

  // Stop physics mode
  function stopPlaying() {
    isPlaying = false;
    
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    const icon = getIconElement();
    
    // Remove event listeners
    if (icon && boundIconMouseDown) {
      icon.removeEventListener('mousedown', boundIconMouseDown, true);
      icon.removeEventListener('touchstart', boundIconTouchStart, true);
    }
    if (boundDocMouseMove) {
      document.removeEventListener('mousemove', boundDocMouseMove, true);
      document.removeEventListener('mouseup', boundDocMouseUp, true);
      document.removeEventListener('touchmove', boundDocTouchMove, true);
      document.removeEventListener('touchend', boundDocTouchEnd, true);
    }
    
    // Reset handlers
    boundIconMouseDown = null;
    boundDocMouseMove = null;
    boundDocMouseUp = null;
    boundIconTouchStart = null;
    boundDocTouchMove = null;
    boundDocTouchEnd = null;
    
    // Reset icon
    if (icon) {
      icon.classList.remove('glass-playing');
      icon.classList.remove('glass-grabbing');
      icon.style.transform = '';
      icon.style.left = '';
      icon.style.right = '20px';
      icon.style.top = '100px';
    }
    
    velocity = { x: 0, y: 0 };
    isDragging = false;
  }

  // Keep old handlers for compatibility but they won't be used
  function handleMouseDown(e) {}
  function handleMouseMove(e) {}
  function handleMouseUp(e) {}
  function handleTouchStart(e) {}
  function handleTouchMove(e) {}
  function handleTouchEnd(e) {}

  // Inject play mode styles
  function injectPlayStyles() {
    if (document.getElementById('glass-play-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'glass-play-styles';
    style.textContent = `
      #glass-ui.glass-playing {
        transition: none !important;
        cursor: grab !important;
        pointer-events: auto !important;
      }
      
      #glass-ui.glass-playing * {
        pointer-events: none !important;
      }
      
      #glass-ui.glass-playing .glass-main {
        transition: transform 0.1s ease-out !important;
        cursor: grab !important;
        pointer-events: auto !important;
        /* Extra shiny when playing */
        box-shadow: 
          0 2px 4px rgba(0, 0, 0, 0.1),
          0 8px 16px rgba(0, 0, 0, 0.15),
          0 16px 32px rgba(0, 0, 0, 0.1),
          inset 0 -8px 16px rgba(0, 0, 0, 0.1),
          inset 0 4px 8px rgba(255, 255, 255, 0.4),
          0 0 20px rgba(76, 140, 90, 0.3) !important;
      }
      
      #glass-ui.glass-grabbing,
      #glass-ui.glass-grabbing .glass-main {
        cursor: grabbing !important;
      }
      
      #glass-ui.glass-playing:active,
      #glass-ui.glass-playing .glass-main:active {
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(style);
  }

  const command = {
    name: 'play',
    aliases: ['ball', 'bounce', 'fun'],
    description: 'Turn the icon into a bouncy ball!',
    usage: 'play',
    examples: [
      'play - Toggle bouncy ball mode (throw the icon around!)'
    ],

    validate(args) {
      return true;
    },

    async execute(args, ctx) {
      const { ui } = ctx;

      injectPlayStyles();

      if (isPlaying) {
        stopPlaying();
        ui.showSuccess('Play mode off! 🎱');
      } else {
        ui.hide();
        startPlaying();
        
        // Show brief instruction
        setTimeout(() => {
          ui.showSuccess('Play mode on! Throw the ball around! 🏀');
        }, 100);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

