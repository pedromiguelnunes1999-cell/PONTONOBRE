<?php
/**
 * Copiar para config.php e preencher a password do email.
 * NÃO fazer commit de config.php (está no .gitignore).
 */
return [
    'smtp_host' => 'mail.pontonobreeventos.pt',
    'smtp_port' => 465, // se falhar, experimentar 587
    'smtp_user' => 'geral@pontonobreeventos.pt',
    'smtp_pass' => 'COLOCAR_PASSWORD_DO_EMAIL_AQUI',
    'to' => 'geral@pontonobreeventos.pt',
    'from_name' => 'Website Ponto Nobre Eventos',
];
