// Artículos de la página de Recursos.
// Los usa recursos.html en el navegador y el servidor (src/coincidencia.js) para sugerir lecturas.
// "temas" son palabras de un requisito de oferta para las que el artículo sirve de ayuda.
const ARTICULOS = [
  {
    "id": "entrevista-preparacion",
    "categoria": "Entrevistas",
    "minutos": 4,
    "titulo": "Cómo prepararse para una entrevista de trabajo",
    "resumen": "Lo que conviene revisar la noche anterior y qué llevar el día de la cita.",
    "cuerpo": [
      "Antes de la entrevista, lea la oferta completa otra vez y subraye los requisitos que usted cumple. Con esa lista es más fácil responder qué puede aportar a la empresa, que casi siempre es la pregunta de fondo.",
      "Busque qué hace la empresa, a quién le vende y dónde está. No hace falta saberlo todo, pero llegar sin saber a qué se dedica se nota enseguida.",
      "Confirme la dirección y calcule el tiempo de viaje con margen. Lleve el currículum impreso, el DUI y un bolígrafo. Si la entrevista es por videollamada, pruebe la cámara, el micrófono y la conexión con anticipación."
    ],
    "temas": [
      "entrevista"
    ]
  },
  {
    "id": "preguntas-frecuentes",
    "categoria": "Entrevistas",
    "minutos": 5,
    "titulo": "Preguntas frecuentes y cómo responderlas",
    "resumen": "Cuatro preguntas que casi siempre aparecen y una forma sencilla de contestarlas.",
    "cuerpo": [
      "«Cuénteme sobre usted» no pide su historia de vida. Responda en un minuto: qué estudió o a qué se dedica, qué experiencia tiene y por qué le interesa el puesto.",
      "Cuando pregunten por una debilidad, mencione algo real y diga qué está haciendo para mejorarla. Contestar que no tiene ninguna suena poco creíble.",
      "Si preguntan por el salario y todavía no conoce el del puesto, puede pedir primero el rango. Si decide dar una cifra, que sea una que pueda justificar con su experiencia.",
      "Al final conviene hacer una pregunta, por ejemplo cómo es un día normal en el puesto o cómo se evalúa el desempeño."
    ],
    "temas": [
      "entrevista"
    ]
  },
  {
    "id": "curriculum-una-pagina",
    "categoria": "Currículum",
    "minutos": 4,
    "titulo": "Un currículum de una página",
    "resumen": "Qué incluir, qué dejar fuera y en qué orden.",
    "cuerpo": [
      "Para un primer empleo o para un puesto operativo, una página basta. Ponga arriba su nombre, teléfono, correo y el departamento donde vive, sin la dirección completa.",
      "Ordene primero lo más reciente y lo que más se parece al puesto. Si todavía no tiene experiencia laboral, empiece por sus estudios y agregue proyectos, prácticas o trabajos voluntarios.",
      "Revise la ortografía dos veces y guarde el archivo en PDF con un nombre claro, por ejemplo «CV_Nombre_Apellido.pdf». La foto no es obligatoria."
    ],
    "temas": [
      "curriculum"
    ]
  },
  {
    "id": "resumen-profesional",
    "categoria": "Currículum",
    "minutos": 3,
    "titulo": "Cómo redactar el resumen profesional",
    "resumen": "Tres o cuatro líneas que se leen antes que todo lo demás.",
    "cuerpo": [
      "El resumen va debajo del nombre y dice quién es usted, qué sabe hacer y qué busca. Evite frases generales como «persona responsable y proactiva»: sirven poco porque cualquiera las escribe.",
      "Es mejor ser concreto: «Técnico en soporte con dos años atendiendo usuarios y administrando impresoras y redes pequeñas». Si tiene un dato que se pueda comprobar, como el número de equipos o de clientes que atendía, inclúyalo.",
      "Cambie el resumen según el puesto. Toma un par de minutos y se nota cuando se hizo para la oferta."
    ],
    "temas": []
  },
  {
    "id": "habilidades-digitales",
    "categoria": "Habilidades",
    "minutos": 4,
    "titulo": "Habilidades digitales que piden con frecuencia",
    "resumen": "Herramientas básicas que conviene dominar en casi cualquier puesto de oficina.",
    "cuerpo": [
      "Muchas ofertas piden Excel sin decir qué nivel. Conviene saber ordenar y filtrar datos, hacer sumas y promedios, usar fórmulas como SI y BUSCARV, y armar una tabla dinámica sencilla.",
      "También se espera que sepa escribir un correo formal, adjuntar archivos, usar videollamadas y compartir documentos en la nube. Si todavía no lo domina, hay cursos gratuitos para empezar.",
      "En la entrevista diga qué herramientas ha usado y para qué, en lugar de decir solamente que maneja computadora."
    ],
    "temas": [
      "excel",
      "word",
      "powerpoint",
      "office",
      "ofimatica",
      "computadora",
      "computacion",
      "informatica",
      "digital",
      "digitales",
      "correo",
      "videollamadas",
      "hojas de calculo",
      "herramientas"
    ]
  },
  {
    "id": "antes-de-aceptar",
    "categoria": "Mercado laboral",
    "minutos": 5,
    "titulo": "Qué revisar antes de aceptar una oferta",
    "resumen": "Puntos del contrato y del puesto que conviene aclarar antes de firmar.",
    "cuerpo": [
      "Pregunte por escrito el salario, el horario, el lugar de trabajo y el tipo de contrato. Si algo de lo que le dijeron en la entrevista no aparece en el contrato, pida que lo agreguen.",
      "En un empleo formal el contrato debe contemplar las prestaciones de ley, como el seguro social, la cotización de pensiones, las vacaciones y el aguinaldo. Si le ofrecen pagarle de otra manera, pida que se lo expliquen con claridad.",
      "Desconfíe de las ofertas que piden dinero para empezar a trabajar o que no dicen el nombre de la empresa. En este portal las empresas pasan por una verificación, pero conviene comprobar que tengan dirección y teléfono reales."
    ],
    "temas": []
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = ARTICULOS;
