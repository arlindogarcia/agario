// Sistema de alternância de backgrounds
(function() {
  const backgrounds = [
    '/games/gotargario/backgrounds/background1.png',
  ];

  let currentIndex = 0;
  let validBackgrounds = [];

  // Verificar quais imagens existem
  async function checkBackgrounds() {
    for (const bg of backgrounds) {
      try {
        const response = await fetch(bg, { method: 'HEAD' });
        if (response.ok) {
          validBackgrounds.push(bg);
          // Pegar apenas as 3 primeiras válidas (1 de cada set)
          if (validBackgrounds.length === 3) break;
        }
      } catch (e) {
        // Imagem não existe, continuar
      }
    }

    // Se encontrou pelo menos uma imagem, iniciar rotação
    if (validBackgrounds.length > 0) {
      startBackgroundRotation();
    } else {
      console.log('🎨 Adicione imagens em /public/backgrounds/ para ter fundos personalizados!');
    }
  }

  // Iniciar rotação de backgrounds
  function startBackgroundRotation() {
    // Mostrar primeira imagem
    changeBackground();

    // Alternar a cada 5 segundos (5000ms)
    setInterval(() => {
      changeBackground();
    }, 5000);
  }

  // Mudar background
  function changeBackground() {
    const img = new Image();
    img.src = validBackgrounds[currentIndex];

    img.onload = function() {
      // Fade out
      document.body.classList.remove('bg-loaded');

      setTimeout(() => {
        // Trocar imagem
        document.body.style.setProperty('--bg-image', `url('${validBackgrounds[currentIndex]}')`);

        // Aplicar no ::before via JavaScript
        const style = document.createElement('style');
        style.id = 'dynamic-bg-style';

        // Remover estilo anterior se existir
        const oldStyle = document.getElementById('dynamic-bg-style');
        if (oldStyle) oldStyle.remove();

        style.textContent = `
          body::before {
            background-image: url('${validBackgrounds[currentIndex]}');
          }
        `;
        document.head.appendChild(style);

        // Fade in
        setTimeout(() => {
          document.body.classList.add('bg-loaded');
        }, 50);

        // Próxima imagem
        currentIndex = (currentIndex + 1) % validBackgrounds.length;
      }, 500);
    };

    img.onerror = function() {
      console.log('Erro ao carregar:', validBackgrounds[currentIndex]);
      // Tentar próxima imagem
      currentIndex = (currentIndex + 1) % validBackgrounds.length;
      if (validBackgrounds.length > 0) {
        changeBackground();
      }
    };
  }

  // Iniciar quando a página carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkBackgrounds);
  } else {
    checkBackgrounds();
  }
})();
