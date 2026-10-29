-- 463 starter questions. Paste into Supabase → SQL Editor → Run. Safe to run twice.
insert into public.questions (text, type, options, answer, alternatives, difficulty, topic, source)
select * from (values
  ('What does CPU stand for?', 'mcq', '["Central Processing Unit","Central Program Utility","Computer Personal Unit","Core Processing Utility"]'::jsonb, 'Central Processing Unit', array[]::text[], 1, 'computers', 'seed'),
  ('Which company makes the iPhone?', 'one_word', null, 'Apple', array[]::text[], 1, 'tech', 'seed'),
  ('Binary numbers use which two digits?', 'mcq', '["0 and 1","1 and 2","0 and 9","A and B"]'::jsonb, '0 and 1', array[]::text[], 1, 'computers', 'seed'),
  ('What does WWW stand for?', 'mcq', '["World Wide Web","World Web Wide","Wide World Web","Web World Wide"]'::jsonb, 'World Wide Web', array[]::text[], 1, 'internet', 'seed'),
  ('Which shortcut copies selected text on Windows?', 'mcq', '["Ctrl+C","Ctrl+V","Ctrl+X","Ctrl+Z"]'::jsonb, 'Ctrl+C', array[]::text[], 1, 'computers', 'seed'),
  ('What is the chemical formula of water?', 'one_word', null, 'H2O', array[]::text[], 1, 'science', 'seed'),
  ('How many bits are in one byte?', 'one_word', null, '8', array['eight']::text[], 1, 'computers', 'seed'),
  ('Which planet is known as the Red Planet?', 'one_word', null, 'Mars', array[]::text[], 1, 'science', 'seed'),
  ('What does RAM stand for?', 'mcq', '["Random Access Memory","Read Access Memory","Rapid Action Memory","Run Access Module"]'::jsonb, 'Random Access Memory', array[]::text[], 1, 'computers', 'seed'),
  ('Which hand-held device is used to point and click on a computer?', 'one_word', null, 'Mouse', array[]::text[], 1, 'computers', 'seed'),
  ('What is the unit of electrical resistance?', 'one_word', null, 'Ohm', array['ohms']::text[], 1, 'electronics', 'seed'),
  ('Which language gives structure to web pages?', 'mcq', '["HTML","Python","SQL","C++"]'::jsonb, 'HTML', array[]::text[], 1, 'web', 'seed'),
  ('What does USB stand for?', 'mcq', '["Universal Serial Bus","United System Bus","Universal Signal Board","Unified Serial Bridge"]'::jsonb, 'Universal Serial Bus', array[]::text[], 1, 'computers', 'seed'),
  ('Who co-founded Microsoft with Paul Allen?', 'mcq', '["Bill Gates","Steve Jobs","Larry Page","Mark Zuckerberg"]'::jsonb, 'Bill Gates', array[]::text[], 1, 'tech', 'seed'),
  ('What is 2 to the power of 10?', 'one_word', null, '1024', array[]::text[], 1, 'math', 'seed'),
  ('Which gas do plants absorb for photosynthesis?', 'mcq', '["Carbon dioxide","Oxygen","Nitrogen","Hydrogen"]'::jsonb, 'Carbon dioxide', array[]::text[], 1, 'science', 'seed'),
  ('Which company develops the Android operating system?', 'mcq', '["Google","Apple","Microsoft","Nokia"]'::jsonb, 'Google', array[]::text[], 1, 'tech', 'seed'),
  ('What is the SI unit of electric current?', 'one_word', null, 'Ampere', array['amperes', 'amp', 'amps']::text[], 1, 'electronics', 'seed'),
  ('Which symbol starts a single-line comment in Python?', 'mcq', '["#","//","<!--","%"]'::jsonb, '#', array[]::text[], 1, 'programming', 'seed'),
  ('What does PDF stand for?', 'mcq', '["Portable Document Format","Printed Document File","Public Data Format","Portable Data File"]'::jsonb, 'Portable Document Format', array[]::text[], 1, 'computers', 'seed'),
  ('Which part of a computer stores data permanently?', 'mcq', '["Hard disk","RAM","Cache","Register"]'::jsonb, 'Hard disk', array[]::text[], 1, 'computers', 'seed'),
  ('Roughly how fast does light travel in km per second?', 'mcq', '["300000","30000","3000","3000000"]'::jsonb, '300000', array[]::text[], 1, 'science', 'seed'),
  ('Which shortcut undoes the last action on Windows?', 'mcq', '["Ctrl+Z","Ctrl+Y","Ctrl+U","Ctrl+A"]'::jsonb, 'Ctrl+Z', array[]::text[], 1, 'computers', 'seed'),
  ('Which number system has base 16?', 'one_word', null, 'Hexadecimal', array['hex']::text[], 1, 'math', 'seed'),
  ('What is the capital city of Karnataka?', 'one_word', null, 'Bengaluru', array['bangalore']::text[], 1, 'general', 'seed'),
  ('Which Indian space agency launched Chandrayaan-3?', 'one_word', null, 'ISRO', array[]::text[], 1, 'general', 'seed'),
  ('What does AI stand for?', 'mcq', '["Artificial Intelligence","Automated Interface","Advanced Internet","Analog Integration"]'::jsonb, 'Artificial Intelligence', array[]::text[], 1, 'ai', 'seed'),
  ('Which of these is an input device?', 'mcq', '["Keyboard","Monitor","Printer","Speaker"]'::jsonb, 'Keyboard', array[]::text[], 1, 'computers', 'seed'),
  ('What does LAN stand for?', 'mcq', '["Local Area Network","Large Access Network","Linked Area Node","Local Access Node"]'::jsonb, 'Local Area Network', array[]::text[], 1, 'networking', 'seed'),
  ('Which component is called the brain of the computer?', 'one_word', null, 'CPU', array['processor']::text[], 1, 'computers', 'seed'),
  ('Which data structure works on the LIFO principle?', 'mcq', '["Stack","Queue","Tree","Graph"]'::jsonb, 'Stack', array[]::text[], 2, 'dsa', 'seed'),
  ('Which data structure works on the FIFO principle?', 'one_word', null, 'Queue', array[]::text[], 2, 'dsa', 'seed'),
  ('What does SQL stand for?', 'mcq', '["Structured Query Language","Simple Query Language","Sequential Query Logic","Standard Question Language"]'::jsonb, 'Structured Query Language', array[]::text[], 2, 'databases', 'seed'),
  ('Which protocol loads web pages over an encrypted connection?', 'one_word', null, 'HTTPS', array[]::text[], 2, 'networking', 'seed'),
  ('What is the decimal value of binary 1010?', 'one_word', null, '10', array['ten']::text[], 2, 'math', 'seed'),
  ('Which logic gate outputs 1 only when both inputs are 1?', 'one_word', null, 'AND', array[]::text[], 2, 'electronics', 'seed'),
  ('Who is known as the father of the computer?', 'mcq', '["Charles Babbage","Alan Turing","John von Neumann","Tim Berners-Lee"]'::jsonb, 'Charles Babbage', array[]::text[], 2, 'tech', 'seed'),
  ('Who invented the World Wide Web?', 'mcq', '["Tim Berners-Lee","Vint Cerf","Bill Gates","Linus Torvalds"]'::jsonb, 'Tim Berners-Lee', array[]::text[], 2, 'internet', 'seed'),
  ('Who created the Linux kernel?', 'mcq', '["Linus Torvalds","Dennis Ritchie","Richard Stallman","Ken Thompson"]'::jsonb, 'Linus Torvalds', array[]::text[], 2, 'tech', 'seed'),
  ('Which programming language did Dennis Ritchie create?', 'one_word', null, 'C', array[]::text[], 2, 'programming', 'seed'),
  ('What is the default port number for HTTP?', 'one_word', null, '80', array[]::text[], 2, 'networking', 'seed'),
  ('What does DNS stand for?', 'mcq', '["Domain Name System","Digital Network Service","Data Name Server","Domain Network Server"]'::jsonb, 'Domain Name System', array[]::text[], 2, 'networking', 'seed'),
  ('What does IP stand for in IP address?', 'mcq', '["Internet Protocol","Internal Port","Internet Provider","Interface Protocol"]'::jsonb, 'Internet Protocol', array[]::text[], 2, 'networking', 'seed'),
  ('Which keyword defines a function in Python?', 'one_word', null, 'def', array[]::text[], 2, 'programming', 'seed'),
  ('Which of these is NOT a programming language?', 'mcq', '["HTTP","Java","Rust","Kotlin"]'::jsonb, 'HTTP', array[]::text[], 2, 'programming', 'seed'),
  ('What does GPU stand for?', 'mcq', '["Graphics Processing Unit","General Processing Unit","Graphical Program Utility","Global Processing Unit"]'::jsonb, 'Graphics Processing Unit', array[]::text[], 2, 'computers', 'seed'),
  ('By Ohm''s law voltage V equals?', 'mcq', '["I x R","I / R","R / I","I + R"]'::jsonb, 'I x R', array[]::text[], 2, 'electronics', 'seed'),
  ('Which version control system did Linus Torvalds create?', 'one_word', null, 'Git', array[]::text[], 2, 'tools', 'seed'),
  ('What is the time complexity of binary search?', 'mcq', '["O(log n)","O(n)","O(n log n)","O(1)"]'::jsonb, 'O(log n)', array[]::text[], 2, 'dsa', 'seed'),
  ('Which HTML tag creates a hyperlink?', 'mcq', '["<a>","<link>","<href>","<p>"]'::jsonb, '<a>', array[]::text[], 2, 'web', 'seed'),
  ('What does CSS stand for?', 'mcq', '["Cascading Style Sheets","Computer Style System","Creative Style Sheets","Colorful Style Syntax"]'::jsonb, 'Cascading Style Sheets', array[]::text[], 2, 'web', 'seed'),
  ('Which company originally created Java?', 'mcq', '["Sun Microsystems","Microsoft","Oracle","IBM"]'::jsonb, 'Sun Microsystems', array[]::text[], 2, 'programming', 'seed'),
  ('In the binary convention how many bytes make one kilobyte?', 'one_word', null, '1024', array[]::text[], 2, 'computers', 'seed'),
  ('What does IoT stand for?', 'mcq', '["Internet of Things","Input of Technology","Integration of Tools","Internet of Telecom"]'::jsonb, 'Internet of Things', array[]::text[], 2, 'tech', 'seed'),
  ('Which is the largest planet in our solar system?', 'one_word', null, 'Jupiter', array[]::text[], 2, 'science', 'seed'),
  ('Which semiconductor material are most computer chips made from?', 'one_word', null, 'Silicon', array[]::text[], 2, 'electronics', 'seed'),
  ('What does OS stand for?', 'mcq', '["Operating System","Open Software","Output Signal","Online Service"]'::jsonb, 'Operating System', array[]::text[], 2, 'computers', 'seed'),
  ('Which sorting algorithm repeatedly swaps adjacent out-of-order elements?', 'mcq', '["Bubble sort","Merge sort","Quick sort","Heap sort"]'::jsonb, 'Bubble sort', array[]::text[], 2, 'dsa', 'seed'),
  ('What does Wi-Fi use to carry data?', 'mcq', '["Radio waves","Infrared light","Copper cables","Fiber optics"]'::jsonb, 'Radio waves', array[]::text[], 2, 'networking', 'seed'),
  ('Which company makes the Snapdragon mobile processors?', 'mcq', '["Qualcomm","Intel","AMD","MediaTek"]'::jsonb, 'Qualcomm', array[]::text[], 2, 'tech', 'seed'),
  ('Which OSI layer is responsible for routing?', 'mcq', '["Network","Transport","Data link","Session"]'::jsonb, 'Network', array[]::text[], 3, 'networking', 'seed'),
  ('How many layers does the OSI model have?', 'one_word', null, '7', array['seven']::text[], 3, 'networking', 'seed'),
  ('What is the default port number for HTTPS?', 'one_word', null, '443', array[]::text[], 3, 'networking', 'seed'),
  ('What is the default port number for SSH?', 'one_word', null, '22', array[]::text[], 3, 'networking', 'seed'),
  ('What is the worst-case time complexity of quicksort?', 'mcq', '["O(n^2)","O(n log n)","O(n)","O(log n)"]'::jsonb, 'O(n^2)', array[]::text[], 3, 'dsa', 'seed'),
  ('Which data structure does breadth-first search use?', 'one_word', null, 'Queue', array[]::text[], 3, 'dsa', 'seed'),
  ('Which data structure manages function calls during recursion?', 'one_word', null, 'Stack', array['call stack']::text[], 3, 'dsa', 'seed'),
  ('What does ACID stand for in databases?', 'mcq', '["Atomicity Consistency Isolation Durability","Accuracy Consistency Integrity Durability","Atomicity Concurrency Isolation Data","Availability Consistency Isolation Durability"]'::jsonb, 'Atomicity Consistency Isolation Durability', array[]::text[], 3, 'databases', 'seed'),
  ('Which normal form removes partial dependencies?', 'mcq', '["2NF","1NF","3NF","BCNF"]'::jsonb, '2NF', array[]::text[], 3, 'databases', 'seed'),
  ('Which Git command copies a remote repository to your machine?', 'one_word', null, 'clone', array['git clone']::text[], 3, 'tools', 'seed'),
  ('Which HTTP status code means Not Found?', 'one_word', null, '404', array[]::text[], 3, 'web', 'seed'),
  ('Which HTTP status code means Internal Server Error?', 'one_word', null, '500', array[]::text[], 3, 'web', 'seed'),
  ('What is the 4-bit two''s complement of 0001?', 'one_word', null, '1111', array[]::text[], 3, 'math', 'seed'),
  ('How many bits are in an IPv4 address?', 'one_word', null, '32', array[]::text[], 3, 'networking', 'seed'),
  ('How many bits are in an IPv6 address?', 'one_word', null, '128', array[]::text[], 3, 'networking', 'seed'),
  ('Which flip-flop toggles its output when both inputs are 1?', 'mcq', '["JK","SR","D","T"]'::jsonb, 'JK', array[]::text[], 3, 'electronics', 'seed'),
  ('Which Java keyword stops a class from being inherited?', 'one_word', null, 'final', array[]::text[], 3, 'programming', 'seed'),
  ('What does the sizeof operator return in C?', 'mcq', '["Size in bytes","Number of elements","Memory address","Bit count"]'::jsonb, 'Size in bytes', array[]::text[], 3, 'programming', 'seed'),
  ('Which CPU scheduling algorithm can starve long jobs?', 'mcq', '["Shortest Job First","Round Robin","First Come First Served"]'::jsonb, 'Shortest Job First', array[]::text[], 3, 'os', 'seed'),
  ('Which protocol maps an IP address to a MAC address?', 'one_word', null, 'ARP', array[]::text[], 3, 'networking', 'seed'),
  ('Which transport protocol is connectionless?', 'one_word', null, 'UDP', array[]::text[], 3, 'networking', 'seed'),
  ('Which of these is a NoSQL database?', 'mcq', '["MongoDB","MySQL","PostgreSQL","Oracle"]'::jsonb, 'MongoDB', array[]::text[], 3, 'databases', 'seed'),
  ('What does JSON stand for?', 'mcq', '["JavaScript Object Notation","Java Standard Object Notation","JavaScript Online Network","Joint Syntax Object Notation"]'::jsonb, 'JavaScript Object Notation', array[]::text[], 3, 'web', 'seed'),
  ('Whose law predicts that transistor counts double about every two years?', 'one_word', null, 'Moore', array['moore''s law', 'moores law', 'moore law']::text[], 3, 'tech', 'seed'),
  ('What is Euler''s number e rounded to two decimal places?', 'one_word', null, '2.72', array[]::text[], 3, 'math', 'seed'),
  ('Which JavaScript keyword declares a constant?', 'one_word', null, 'const', array[]::text[], 3, 'programming', 'seed'),
  ('Which Python data type is immutable?', 'mcq', '["tuple","list","dict","set"]'::jsonb, 'tuple', array[]::text[], 3, 'programming', 'seed'),
  ('Which circuit converts AC to DC?', 'one_word', null, 'Rectifier', array[]::text[], 3, 'electronics', 'seed'),
  ('Which of these is a universal logic gate?', 'mcq', '["NAND","XOR","OR","NOT"]'::jsonb, 'NAND', array[]::text[], 3, 'electronics', 'seed'),
  ('Which company''s researchers wrote the paper Attention Is All You Need?', 'mcq', '["Google","OpenAI","Meta","Microsoft"]'::jsonb, 'Google', array[]::text[], 3, 'ai', 'seed'),
  ('What is the time complexity of building a binary heap from n elements?', 'mcq', '["O(n)","O(n log n)","O(log n)","O(n^2)"]'::jsonb, 'O(n)', array[]::text[], 4, 'dsa', 'seed'),
  ('Which algorithm finds shortest paths in a graph with non-negative edge weights?', 'one_word', null, 'Dijkstra', array['dijkstra''s', 'dijkstras']::text[], 4, 'dsa', 'seed'),
  ('Which shortest-path algorithm works with negative edge weights?', 'mcq', '["Bellman-Ford","Dijkstra","Prim","Kruskal"]'::jsonb, 'Bellman-Ford', array[]::text[], 4, 'dsa', 'seed'),
  ('Which minimum spanning tree algorithm sorts all edges by weight first?', 'one_word', null, 'Kruskal', array['kruskal''s', 'kruskals']::text[], 4, 'dsa', 'seed'),
  ('How many steps are in the TCP connection handshake?', 'one_word', null, '3', array['three']::text[], 4, 'networking', 'seed'),
  ('Which idempotent HTTP method replaces a resource?', 'one_word', null, 'PUT', array[]::text[], 4, 'web', 'seed'),
  ('What is the subnet mask of a /24 network?', 'mcq', '["255.255.255.0","255.255.0.0","255.0.0.0","255.255.255.255"]'::jsonb, '255.255.255.0', array[]::text[], 4, 'networking', 'seed'),
  ('How many usable host addresses does a /24 subnet have?', 'one_word', null, '254', array[]::text[], 4, 'networking', 'seed'),
  ('Which page replacement algorithm suffers from Belady''s anomaly?', 'one_word', null, 'FIFO', array['first in first out']::text[], 4, 'os', 'seed'),
  ('In the CAP theorem what does C stand for?', 'mcq', '["Consistency","Concurrency","Capacity","Correctness"]'::jsonb, 'Consistency', array[]::text[], 4, 'systems', 'seed'),
  ('Which of these sorting algorithms is stable?', 'mcq', '["Merge sort","Quick sort","Heap sort","Selection sort"]'::jsonb, 'Merge sort', array[]::text[], 4, 'dsa', 'seed'),
  ('Which data structure gives O(1) average-time lookup?', 'mcq', '["Hash table","Binary search tree","Linked list","Heap"]'::jsonb, 'Hash table', array[]::text[], 4, 'dsa', 'seed'),
  ('What is the time complexity of merge sort?', 'mcq', '["O(n log n)","O(n^2)","O(n)","O(log n)"]'::jsonb, 'O(n log n)', array[]::text[], 4, 'dsa', 'seed'),
  ('Which Linux command changes file permissions?', 'one_word', null, 'chmod', array[]::text[], 4, 'os', 'seed'),
  ('Which register holds the address of the next instruction?', 'mcq', '["Program Counter","Accumulator","Stack Pointer","Instruction Register"]'::jsonb, 'Program Counter', array[]::text[], 4, 'computers', 'seed'),
  ('Which addressing scheme allows variable-length subnet masks?', 'mcq', '["CIDR","Classful addressing","NAT","DHCP"]'::jsonb, 'CIDR', array[]::text[], 4, 'networking', 'seed'),
  ('What does DHCP assign to devices automatically?', 'mcq', '["IP addresses","MAC addresses","Domain names","Port numbers"]'::jsonb, 'IP addresses', array[]::text[], 4, 'networking', 'seed'),
  ('Which SQL clause filters groups after aggregation?', 'one_word', null, 'HAVING', array[]::text[], 4, 'databases', 'seed'),
  ('Which SQL join returns only rows that match in both tables?', 'mcq', '["INNER JOIN","LEFT JOIN","FULL JOIN","CROSS JOIN"]'::jsonb, 'INNER JOIN', array[]::text[], 4, 'databases', 'seed'),
  ('What is hexadecimal 0xFF in decimal?', 'one_word', null, '255', array[]::text[], 4, 'math', 'seed'),
  ('In SOLID principles what does the S stand for?', 'mcq', '["Single responsibility","Separation of concerns","Simple design","Static typing"]'::jsonb, 'Single responsibility', array[]::text[], 4, 'programming', 'seed'),
  ('Which design pattern ensures a class has only one instance?', 'one_word', null, 'Singleton', array[]::text[], 4, 'programming', 'seed'),
  ('Which machine learning task predicts a continuous value?', 'one_word', null, 'Regression', array[]::text[], 4, 'ai', 'seed'),
  ('Which activation function outputs max(0 and x)?', 'one_word', null, 'ReLU', array[]::text[], 4, 'ai', 'seed'),
  ('Which metric is the harmonic mean of precision and recall?', 'mcq', '["F1 score","Accuracy","AUC","Log loss"]'::jsonb, 'F1 score', array[]::text[], 4, 'ai', 'seed'),
  ('What is the Nyquist sampling rate for a signal whose highest frequency is f?', 'mcq', '["2f","f","f/2","4f"]'::jsonb, '2f', array[]::text[], 4, 'electronics', 'seed'),
  ('Which BJT configuration is also called an emitter follower?', 'mcq', '["Common collector","Common emitter","Common base"]'::jsonb, 'Common collector', array[]::text[], 4, 'electronics', 'seed'),
  ('Which of these encryption algorithms is asymmetric?', 'mcq', '["RSA","AES","DES","Blowfish"]'::jsonb, 'RSA', array[]::text[], 4, 'security', 'seed'),
  ('Which hash function does Bitcoin mining use?', 'one_word', null, 'SHA-256', array['sha256', 'sha 256']::text[], 4, 'security', 'seed'),
  ('What is the default port number for DNS?', 'one_word', null, '53', array[]::text[], 4, 'networking', 'seed'),
  ('Which complexity class contains problems whose solutions can be verified in polynomial time?', 'one_word', null, 'NP', array[]::text[], 5, 'theory', 'seed'),
  ('Who proposed the imitation game now called the Turing test?', 'mcq', '["Alan Turing","John McCarthy","Marvin Minsky","Claude Shannon"]'::jsonb, 'Alan Turing', array[]::text[], 5, 'ai', 'seed'),
  ('Who coined the term artificial intelligence?', 'mcq', '["John McCarthy","Alan Turing","Geoffrey Hinton","Herbert Simon"]'::jsonb, 'John McCarthy', array[]::text[], 5, 'ai', 'seed'),
  ('Who is known as the father of information theory?', 'mcq', '["Claude Shannon","Norbert Wiener","Alan Turing","John von Neumann"]'::jsonb, 'Claude Shannon', array[]::text[], 5, 'theory', 'seed'),
  ('Which consensus algorithm used by etcd was designed to be easy to understand?', 'one_word', null, 'Raft', array[]::text[], 5, 'systems', 'seed'),
  ('What is the amortized time to append to a dynamic array?', 'mcq', '["O(1)","O(n)","O(log n)","O(n log n)"]'::jsonb, 'O(1)', array[]::text[], 5, 'dsa', 'seed'),
  ('Which self-balancing tree uses node colours and rotations?', 'mcq', '["Red-black tree","AVL tree","B-tree","Trie"]'::jsonb, 'Red-black tree', array[]::text[], 5, 'dsa', 'seed'),
  ('Which tree data structure is best suited to prefix autocomplete?', 'one_word', null, 'Trie', array['prefix tree']::text[], 5, 'dsa', 'seed'),
  ('Which attack injects malicious scripts into pages viewed by other users?', 'mcq', '["Cross-site scripting","SQL injection","Phishing","Man-in-the-middle"]'::jsonb, 'Cross-site scripting', array[]::text[], 5, 'security', 'seed'),
  ('Which CSP directive controls which sites may embed a page in a frame?', 'one_word', null, 'frame-ancestors', array['frame ancestors']::text[], 5, 'security', 'seed'),
  ('Which algorithm computes the gradients used to train neural networks?', 'one_word', null, 'Backpropagation', array['backprop', 'back propagation']::text[], 5, 'ai', 'seed'),
  ('Which mechanism in transformers lets each token weigh every other token?', 'one_word', null, 'Attention', array['self-attention', 'self attention']::text[], 5, 'ai', 'seed'),
  ('Which ensemble method trains many decision trees on bootstrap samples?', 'mcq', '["Random forest","Gradient boosting","Support vector machine","K-nearest neighbours"]'::jsonb, 'Random forest', array[]::text[], 5, 'ai', 'seed'),
  ('What does GAN stand for in machine learning?', 'mcq', '["Generative Adversarial Network","General Artificial Network","Gradient Activation Network","Graph Attention Network"]'::jsonb, 'Generative Adversarial Network', array[]::text[], 5, 'ai', 'seed'),
  ('SAT was the first problem proven complete for which complexity class?', 'one_word', null, 'NP', array['np-complete', 'np complete']::text[], 5, 'theory', 'seed'),
  ('Which theorem proved that SAT is NP-complete?', 'mcq', '["Cook-Levin theorem","Church-Turing thesis","Rice''s theorem","Godel''s incompleteness theorem"]'::jsonb, 'Cook-Levin theorem', array[]::text[], 5, 'theory', 'seed'),
  ('What is the time complexity of the Floyd-Warshall algorithm?', 'mcq', '["O(V^3)","O(V^2)","O(E log V)","O(VE)"]'::jsonb, 'O(V^3)', array[]::text[], 5, 'dsa', 'seed'),
  ('Which algorithm computes the RSA private exponent from the public one?', 'mcq', '["Extended Euclidean algorithm","Sieve of Eratosthenes","Dijkstra''s algorithm","Fast Fourier Transform"]'::jsonb, 'Extended Euclidean algorithm', array[]::text[], 5, 'security', 'seed'),
  ('Which protocol provides the encryption in modern HTTPS?', 'one_word', null, 'TLS', array['transport layer security']::text[], 5, 'security', 'seed'),
  ('Which cache mapping places each memory block in exactly one cache line?', 'mcq', '["Direct mapped","Fully associative","Set associative","Write back"]'::jsonb, 'Direct mapped', array[]::text[], 5, 'computers', 'seed'),
  ('Which Unix system call creates a new process by duplicating the caller?', 'one_word', null, 'fork', array['fork()']::text[], 5, 'os', 'seed'),
  ('Which IEEE standard defines floating-point arithmetic?', 'one_word', null, '754', array['ieee 754', 'ieee754']::text[], 5, 'computers', 'seed'),
  ('How many fraction bits does IEEE 754 single precision store?', 'one_word', null, '23', array[]::text[], 5, 'computers', 'seed'),
  ('Which modulation scheme varies the carrier''s frequency?', 'one_word', null, 'FM', array['frequency modulation']::text[], 5, 'electronics', 'seed'),
  ('Which theorem gives the maximum data rate of a noisy channel?', 'mcq', '["Shannon-Hartley theorem","Nyquist theorem","Fourier theorem","Bayes'' theorem"]'::jsonb, 'Shannon-Hartley theorem', array[]::text[], 5, 'electronics', 'seed'),
  ('What is the smallest deployable unit in Kubernetes?', 'one_word', null, 'Pod', array['pods']::text[], 5, 'systems', 'seed'),
  ('Which garbage collection technique cannot reclaim reference cycles on its own?', 'mcq', '["Reference counting","Mark and sweep","Copying collection","Generational collection"]'::jsonb, 'Reference counting', array[]::text[], 5, 'programming', 'seed'),
  ('Which pipeline hazard occurs when an instruction needs the result of a previous one?', 'mcq', '["Data hazard","Control hazard","Structural hazard","Memory hazard"]'::jsonb, 'Data hazard', array[]::text[], 5, 'computers', 'seed'),
  ('Which index structure do relational databases like PostgreSQL use by default?', 'one_word', null, 'B-tree', array['btree', 'b tree', 'b+ tree', 'b+tree']::text[], 5, 'databases', 'seed'),
  ('Which quantum gate puts a qubit into an equal superposition?', 'one_word', null, 'Hadamard', array['h gate', 'hadamard gate']::text[], 5, 'theory', 'seed'),
  ('What does this print?
print(2 + 3)', 'mcq', '["5","23","2 + 3","Error"]'::jsonb, '5', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print("ha" * 3)', 'mcq', '["Error","hahaha","ha3","ha ha ha"]'::jsonb, 'hahaha', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print(len("cat"))', 'one_word', null, '3', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print(10 - 4)', 'one_word', null, '6', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print("Hello"[0])', 'one_word', null, 'H', array[]::text[], 1, 'coding', 'seed'),
  ('Which symbol starts a comment in Python?', 'mcq', '["/*","#","//","--"]'::jsonb, '#', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
x = 4
x = x + 1
print(x)', 'one_word', null, '5', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print("cat" + "dog")', 'one_word', null, 'catdog', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print(type(5).__name__)', 'mcq', '["int","float","str","bool"]'::jsonb, 'int', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print(len([4, 8, 15]))', 'one_word', null, '3', array[]::text[], 1, 'coding', 'seed'),
  ('Which of these is a Python list?', 'mcq', '["{1, 2, 3}","<1, 2, 3>","[1, 2, 3]","(1, 2, 3)"]'::jsonb, '[1, 2, 3]', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print("5" + "5")', 'mcq', '["10","5 + 5","Error","55"]'::jsonb, '55', array[]::text[], 1, 'coding', 'seed'),
  ('What does this print?
print(1 + 1 == 2)', 'mcq', '["True","False","2","Error"]'::jsonb, 'True', array[]::text[], 1, 'coding', 'seed'),
  ('What does "www" stand for in a web address?', 'mcq', '["Wide World Web","World Wide Web","World Wide Wire","Web Wide World"]'::jsonb, 'World Wide Web', array[]::text[], 1, 'tech', 'seed'),
  ('Which keyboard shortcut copies on Windows?', 'mcq', '["Ctrl + X","Ctrl + Z","Ctrl + C","Ctrl + V"]'::jsonb, 'Ctrl + C', array[]::text[], 1, 'tech', 'seed'),
  ('What do programmers call a mistake in their code?', 'one_word', null, 'bug', array['a bug', 'bugs']::text[], 1, 'tech', 'seed'),
  ('Which of these is a web browser?', 'mcq', '["Windows","Chrome","Excel","Photoshop"]'::jsonb, 'Chrome', array[]::text[], 1, 'tech', 'seed'),
  ('What does "AI" stand for?', 'mcq', '["Automatic Internet","Advanced Input","Actual Information","Artificial Intelligence"]'::jsonb, 'Artificial Intelligence', array[]::text[], 1, 'tech', 'seed'),
  ('Which shortcut undoes your last action on most computers?', 'mcq', '["Ctrl + Z","Ctrl + U","Ctrl + Y","Ctrl + D"]'::jsonb, 'Ctrl + Z', array[]::text[], 1, 'tech', 'seed'),
  ('Which part of a computer do you move around to point at the screen?', 'one_word', null, 'mouse', array['a mouse', 'computer mouse']::text[], 1, 'tech', 'seed'),
  ('Which device do you use to type letters into a computer?', 'mcq', '["Speaker","Printer","Keyboard","Monitor"]'::jsonb, 'Keyboard', array[]::text[], 1, 'tech', 'seed'),
  ('Which of these is a video-calling app?', 'mcq', '["Paint","Notepad","Calculator","Zoom"]'::jsonb, 'Zoom', array[]::text[], 1, 'tech', 'seed'),
  ('What is the largest planet in our solar system?', 'one_word', null, 'Jupiter', array[]::text[], 1, 'science', 'seed'),
  ('Which animal is known as the King of the Jungle?', 'mcq', '["Bear","Lion","Tiger","Elephant"]'::jsonb, 'Lion', array[]::text[], 1, 'gk', 'seed'),
  ('How many continents are there on Earth?', 'one_word', null, '7', array[]::text[], 1, 'geography', 'seed'),
  ('What colour do you get when you mix blue and yellow?', 'one_word', null, 'green', array[]::text[], 1, 'gk', 'seed'),
  ('What is the national animal of India?', 'mcq', '["Tiger","Lion","Elephant","Peacock"]'::jsonb, 'Tiger', array[]::text[], 1, 'gk', 'seed'),
  ('What is the capital of India?', 'one_word', null, 'New Delhi', array['delhi', 'newdelhi']::text[], 1, 'geography', 'seed'),
  ('How many legs does a spider have?', 'one_word', null, '8', array[]::text[], 1, 'science', 'seed'),
  ('Which festival is known as the festival of lights?', 'mcq', '["Holi","Eid","Christmas","Diwali"]'::jsonb, 'Diwali', array[]::text[], 1, 'culture', 'seed'),
  ('What is frozen water called?', 'one_word', null, 'ice', array[]::text[], 1, 'science', 'seed'),
  ('How many hours are in a day?', 'one_word', null, '24', array[]::text[], 1, 'gk', 'seed'),
  ('Which shape has three sides?', 'mcq', '["Circle","Pentagon","Triangle","Square"]'::jsonb, 'Triangle', array[]::text[], 1, 'math', 'seed'),
  ('What is 12 × 12?', 'one_word', null, '144', array[]::text[], 1, 'math', 'seed'),
  ('In which direction does the sun rise?', 'mcq', '["East","West","North","South"]'::jsonb, 'East', array[]::text[], 1, 'science', 'seed'),
  ('What is the opposite of "hot"?', 'one_word', null, 'cold', array[]::text[], 1, 'gk', 'seed'),
  ('Which organ pumps blood around your body?', 'one_word', null, 'heart', array['the heart']::text[], 1, 'science', 'seed'),
  ('How many players does a cricket team have on the field?', 'one_word', null, '11', array[]::text[], 1, 'sports', 'seed'),
  ('What is the national bird of India?', 'mcq', '["Peacock","Parrot","Eagle","Sparrow"]'::jsonb, 'Peacock', array[]::text[], 1, 'gk', 'seed'),
  ('What do bees make?', 'one_word', null, 'honey', array[]::text[], 1, 'science', 'seed'),
  ('How many days are in a leap year?', 'one_word', null, '366', array[]::text[], 1, 'gk', 'seed'),
  ('What do caterpillars turn into?', 'mcq', '["Bees","Spiders","Worms","Butterflies"]'::jsonb, 'Butterflies', array[]::text[], 1, 'science', 'seed'),
  ('What colour is a ripe banana?', 'one_word', null, 'yellow', array[]::text[], 1, 'gk', 'seed'),
  ('Which planet do we live on?', 'mcq', '["Jupiter","Earth","Mars","Venus"]'::jsonb, 'Earth', array[]::text[], 1, 'science', 'seed'),
  ('How many sides does a square have?', 'one_word', null, '4', array[]::text[], 1, 'math', 'seed'),
  ('Which sport is played at Wimbledon?', 'one_word', null, 'tennis', array['lawn tennis']::text[], 1, 'sports', 'seed'),
  ('How many colours are in a rainbow?', 'one_word', null, '7', array[]::text[], 1, 'science', 'seed'),
  ('Which of these is a fruit?', 'mcq', '["Onion","Mango","Potato","Carrot"]'::jsonb, 'Mango', array[]::text[], 1, 'gk', 'seed'),
  ('What is the capital of Karnataka?', 'one_word', null, 'Bengaluru', array['bangalore']::text[], 1, 'geography', 'seed'),
  ('How many wheels does a bicycle have?', 'one_word', null, '2', array[]::text[], 1, 'gk', 'seed'),
  ('What is the capital of Maharashtra?', 'one_word', null, 'Mumbai', array['bombay']::text[], 1, 'geography', 'seed'),
  ('Which of these animals can fly?', 'mcq', '["Snake","Bat","Elephant","Dolphin"]'::jsonb, 'Bat', array[]::text[], 1, 'science', 'seed'),
  ('What do you call a house made of ice blocks?', 'one_word', null, 'igloo', array['an igloo']::text[], 1, 'gk', 'seed'),
  ('What is the main ingredient of guacamole?', 'mcq', '["Tomato","Potato","Cucumber","Avocado"]'::jsonb, 'Avocado', array[]::text[], 1, 'gk', 'seed'),
  ('Which colour is at the top of the Indian flag?', 'mcq', '["Saffron","Green","White","Blue"]'::jsonb, 'Saffron', array[]::text[], 1, 'gk', 'seed'),
  ('Which animal is known as the ship of the desert?', 'one_word', null, 'camel', array['a camel']::text[], 1, 'gk', 'seed'),
  ('You have 5 chocolates and eat 2. How many are left?', 'one_word', null, '3', array[]::text[], 1, 'math', 'seed'),
  ('What has keys but can''t open locks?', 'one_word', null, 'keyboard', array['piano', 'a piano', 'a keyboard']::text[], 1, 'riddle', 'seed'),
  ('What gets wetter the more it dries?', 'one_word', null, 'towel', array['a towel']::text[], 1, 'riddle', 'seed'),
  ('Why did the developer go broke?', 'mcq', '["He deleted the internet","He used up all his cache","He forgot his password","His laptop ran out of charge"]'::jsonb, 'He used up all his cache', array[]::text[], 1, 'meme', 'seed'),
  ('I''m tall when I''m young and short when I''m old. What am I?', 'one_word', null, 'candle', array['a candle']::text[], 1, 'riddle', 'seed'),
  ('"It works on my machine!" is a famous excuse from…', 'mcq', '["Doctors","Pilots","Chefs","Programmers"]'::jsonb, 'Programmers', array[]::text[], 1, 'meme', 'seed'),
  ('What has a head and a tail but no body?', 'one_word', null, 'coin', array['a coin']::text[], 1, 'riddle', 'seed'),
  ('Which emoji is called "face with tears of joy"?', 'mcq', '["😡","😂","😭","😅"]'::jsonb, '😂', array[]::text[], 1, 'meme', 'seed'),
  ('What has hands but can''t clap?', 'one_word', null, 'clock', array['a clock', 'watch', 'a watch']::text[], 1, 'riddle', 'seed'),
  ('Which animal says "moo"?', 'mcq', '["Dog","Cat","Duck","Cow"]'::jsonb, 'Cow', array[]::text[], 1, 'funny', 'seed'),
  ('What goes up but never comes down?', 'one_word', null, 'age', array['your age', 'my age']::text[], 1, 'riddle', 'seed'),
  ('What does this print?
print(3 ** 2)', 'mcq', '["32","9","6","8"]'::jsonb, '9', array[]::text[], 2, 'coding', 'seed'),
  ('How many lines does this print?
for i in range(3):
    print(i)', 'one_word', null, '3', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
total = 0
for n in [1, 2, 3, 4]:
    total += n
print(total)', 'one_word', null, '10', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print("python"[-1])', 'one_word', null, 'n', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print(5 == 5.0)', 'mcq', '["None","True","False","Error"]'::jsonb, 'True', array[]::text[], 2, 'coding', 'seed'),
  ('Fix the bug: which word should replace prnt?
prnt("Hello")', 'one_word', null, 'print', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
x = [10, 20, 30]
print(x[1])', 'one_word', null, '20', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print(bool(0))', 'mcq', '["False","True","0","None"]'::jsonb, 'False', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print("Hi".replace("i", "o"))', 'one_word', null, 'Ho', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print(int("7") + 3)', 'mcq', '["Error","7 + 3","10","73"]'::jsonb, '10', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print(len("hello world"))', 'one_word', null, '11', array[]::text[], 2, 'coding', 'seed'),
  ('In JavaScript, what does this print?
console.log(typeof "5")', 'mcq', '["string","number","char","text"]'::jsonb, 'string', array[]::text[], 2, 'coding', 'seed'),
  ('What does this print?
print(max(4, 9, 2))', 'one_word', null, '9', array[]::text[], 2, 'coding', 'seed'),
  ('What does HTML stand for?', 'mcq', '["Hyperlink and Text Markup Language","Home Tool Markup Language","HyperText Markup Language","High Text Machine Language"]'::jsonb, 'HyperText Markup Language', array[]::text[], 2, 'tech', 'seed'),
  ('Which of these keeps your files when the power goes off?', 'mcq', '["RAM","CPU cache","Registers","SSD"]'::jsonb, 'SSD', array[]::text[], 2, 'tech', 'seed'),
  ('What does the "S" in HTTPS stand for?', 'one_word', null, 'secure', array[]::text[], 2, 'tech', 'seed'),
  ('Which company owns Android today?', 'mcq', '["Samsung","Google","Apple","Microsoft"]'::jsonb, 'Google', array[]::text[], 2, 'tech', 'seed'),
  ('What is the binary number 101 in decimal?', 'one_word', null, '5', array[]::text[], 2, 'tech', 'seed'),
  ('Which of these is NOT an operating system?', 'mcq', '["Linux","Windows","macOS","Excel"]'::jsonb, 'Excel', array[]::text[], 2, 'tech', 'seed'),
  ('What is the main circuit board inside a computer called?', 'one_word', null, 'motherboard', array['mainboard', 'mother board']::text[], 2, 'tech', 'seed'),
  ('Which language is mainly used to style web pages?', 'mcq', '["Java","CSS","SQL","C"]'::jsonb, 'CSS', array[]::text[], 2, 'tech', 'seed'),
  ('Which keyboard shortcut pastes on Windows?', 'mcq', '["Ctrl + C","Ctrl + B","Ctrl + V","Ctrl + P"]'::jsonb, 'Ctrl + V', array[]::text[], 2, 'tech', 'seed'),
  ('What is the name of Apple''s voice assistant?', 'one_word', null, 'Siri', array[]::text[], 2, 'tech', 'seed'),
  ('What is the capital of Japan?', 'one_word', null, 'Tokyo', array[]::text[], 2, 'geography', 'seed'),
  ('How many states does India have?', 'one_word', null, '28', array[]::text[], 2, 'geography', 'seed'),
  ('Who was the first Prime Minister of India?', 'mcq', '["Indira Gandhi","Rajendra Prasad","Jawaharlal Nehru","Sardar Patel"]'::jsonb, 'Jawaharlal Nehru', array[]::text[], 2, 'history', 'seed'),
  ('Which planet is closest to the Sun?', 'one_word', null, 'Mercury', array[]::text[], 2, 'science', 'seed'),
  ('What is the hardest natural substance?', 'mcq', '["Diamond","Iron","Gold","Granite"]'::jsonb, 'Diamond', array[]::text[], 2, 'science', 'seed'),
  ('How many sides does a hexagon have?', 'one_word', null, '6', array[]::text[], 2, 'math', 'seed'),
  ('In which year did India become independent?', 'one_word', null, '1947', array[]::text[], 2, 'history', 'seed'),
  ('Which instrument has 88 keys?', 'mcq', '["Piano","Guitar","Violin","Flute"]'::jsonb, 'Piano', array[]::text[], 2, 'culture', 'seed'),
  ('What is the currency of Japan?', 'one_word', null, 'yen', array[]::text[], 2, 'geography', 'seed'),
  ('Mount Everest lies on the border of Nepal and…', 'mcq', '["Bhutan","Pakistan","China","India"]'::jsonb, 'China', array[]::text[], 2, 'geography', 'seed'),
  ('How many minutes are in 2 hours?', 'one_word', null, '120', array[]::text[], 2, 'math', 'seed'),
  ('Who painted the Mona Lisa?', 'one_word', null, 'Leonardo da Vinci', array['da vinci', 'leonardo', 'davinci', 'leonardo davinci']::text[], 2, 'history', 'seed'),
  ('Which blood cells fight infections?', 'mcq', '["Plasma","White blood cells","Red blood cells","Platelets"]'::jsonb, 'White blood cells', array[]::text[], 2, 'science', 'seed'),
  ('Which ocean is the largest?', 'one_word', null, 'Pacific', array['pacific ocean', 'the pacific']::text[], 2, 'geography', 'seed'),
  ('Which gas do we breathe in to stay alive?', 'mcq', '["Carbon dioxide","Nitrogen","Helium","Oxygen"]'::jsonb, 'Oxygen', array[]::text[], 2, 'science', 'seed'),
  ('How many weeks are in a year?', 'one_word', null, '52', array[]::text[], 2, 'gk', 'seed'),
  ('Which country is famous for the pyramids of Giza?', 'one_word', null, 'Egypt', array[]::text[], 2, 'geography', 'seed'),
  ('Who is known as the Father of the Nation in India?', 'mcq', '["Subhas Chandra Bose","B. R. Ambedkar","Mahatma Gandhi","Jawaharlal Nehru"]'::jsonb, 'Mahatma Gandhi', array[]::text[], 2, 'history', 'seed'),
  ('How many players from one team are on the mat in kabaddi?', 'one_word', null, '7', array[]::text[], 2, 'sports', 'seed'),
  ('What do you call a baby dog?', 'one_word', null, 'puppy', array['pup']::text[], 2, 'gk', 'seed'),
  ('Which is the largest mammal?', 'mcq', '["Hippopotamus","Blue whale","Elephant","Giraffe"]'::jsonb, 'Blue whale', array[]::text[], 2, 'science', 'seed'),
  ('Which gas do plants take in from the air?', 'one_word', null, 'carbon dioxide', array['co2', 'carbon-dioxide']::text[], 2, 'science', 'seed'),
  ('Which sport uses a shuttlecock?', 'mcq', '["Tennis","Squash","Table tennis","Badminton"]'::jsonb, 'Badminton', array[]::text[], 2, 'sports', 'seed'),
  ('What is 15 + 27?', 'one_word', null, '42', array[]::text[], 2, 'math', 'seed'),
  ('How many years are in a century?', 'one_word', null, '100', array[]::text[], 2, 'gk', 'seed'),
  ('What is the national flower of India?', 'one_word', null, 'lotus', array[]::text[], 2, 'gk', 'seed'),
  ('How many months have 28 days?', 'one_word', null, '12', array[]::text[], 2, 'riddle', 'seed'),
  ('What can you catch but not throw?', 'one_word', null, 'cold', array['a cold']::text[], 2, 'riddle', 'seed'),
  ('What has to be broken before you can use it?', 'one_word', null, 'egg', array['an egg']::text[], 2, 'riddle', 'seed'),
  ('Finish the line: "Keep calm and…"', 'mcq', '["shout loudly","go to sleep","carry on","run away"]'::jsonb, 'carry on', array[]::text[], 2, 'meme', 'seed'),
  ('What has one eye but cannot see?', 'one_word', null, 'needle', array['a needle']::text[], 2, 'riddle', 'seed'),
  ('What is a "meme", usually?', 'mcq', '["A funny picture or video shared online","A type of computer virus","A music instrument","A cooking recipe"]'::jsonb, 'A funny picture or video shared online', array[]::text[], 2, 'meme', 'seed'),
  ('What runs but never walks, and has a mouth but never talks?', 'one_word', null, 'river', array['a river']::text[], 2, 'riddle', 'seed'),
  ('In the classic arcade game, what does Pac-Man eat?', 'mcq', '["Bananas","Stars","Dots","Coins"]'::jsonb, 'Dots', array[]::text[], 2, 'meme', 'seed'),
  ('Which building has the most stories?', 'one_word', null, 'library', array['a library', 'the library']::text[], 2, 'riddle', 'seed'),
  ('Twitter''s old logo (before it became X) was a…', 'mcq', '["Bird","Fish","Cat","Star"]'::jsonb, 'Bird', array[]::text[], 2, 'meme', 'seed'),
  ('A cat has 4 legs. How many legs do 3 cats have?', 'one_word', null, '12', array[]::text[], 2, 'math', 'seed'),
  ('Which superhero calls himself your "friendly neighbourhood" hero?', 'mcq', '["Superman","Iron Man","Spider-Man","Batman"]'::jsonb, 'Spider-Man', array[]::text[], 2, 'meme', 'seed'),
  ('What does this print?
x = 5
y = x
x = 10
print(y)', 'one_word', null, '5', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print([1, 2, 3][::-1])', 'mcq', '["[3, 2, 1]","[1, 2, 3]","[3]","Error"]'::jsonb, '[3, 2, 1]', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
count = 0
for i in range(1, 11):
    if i % 2 == 0:
        count += 1
print(count)', 'one_word', null, '5', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print("banana".count("a"))', 'one_word', null, '3', array[]::text[], 3, 'coding', 'seed'),
  ('Fix the bug: what is missing?
if x > 5
    print("big")', 'mcq', '["A bracket after if","A semicolon after 5","Quotes around x","A colon after 5"]'::jsonb, 'A colon after 5', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
def double(n):
    return n * 2
print(double(double(3)))', 'one_word', null, '12', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print(10 / 4)', 'mcq', '["3","2.5","2","2.0"]'::jsonb, '2.5', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
words = ["sun", "moon", "star"]
print(words[-1])', 'one_word', null, 'star', array[]::text[], 3, 'coding', 'seed'),
  ('In JavaScript, what does this print?
console.log(1 + "1")', 'mcq', '["2","NaN","Error","11"]'::jsonb, '11', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
nums = [3, 7, 1, 9]
print(max(nums) - min(nums))', 'one_word', null, '8', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print("a" in "cat")', 'mcq', '["a","True","False","Error"]'::jsonb, 'True', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
i = 0
while i < 5:
    i += 2
print(i)', 'one_word', null, '6', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print("-".join(["a", "b", "c"]))', 'one_word', null, 'a-b-c', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print("Python"[1:4])', 'mcq', '["yth","Pyt","ytho","thon"]'::jsonb, 'yth', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print(abs(-7))', 'one_word', null, '7', array[]::text[], 3, 'coding', 'seed'),
  ('What does this print?
print("hello".find("l"))', 'one_word', null, '2', array[]::text[], 3, 'coding', 'seed'),
  ('Which protocol does your browser use to load web pages?', 'mcq', '["HTTP","FTP","SMTP","SSH"]'::jsonb, 'HTTP', array[]::text[], 3, 'tech', 'seed'),
  ('What is the binary number 1010 in decimal?', 'one_word', null, '10', array[]::text[], 3, 'tech', 'seed'),
  ('Which data structure is "first in, first out"?', 'mcq', '["Tree","Graph","Queue","Stack"]'::jsonb, 'Queue', array[]::text[], 3, 'tech', 'seed'),
  ('Which of these is a version control system?', 'mcq', '["Jira","Slack","Figma","Git"]'::jsonb, 'Git', array[]::text[], 3, 'tech', 'seed'),
  ('What does a "404" error on a website mean?', 'mcq', '["Wrong password","Page not found","The server is on fire","No internet at all"]'::jsonb, 'Page not found', array[]::text[], 3, 'tech', 'seed'),
  ('Which file extension do Python files use?', 'mcq', '[".pt",".pn",".java",".py"]'::jsonb, '.py', array[]::text[], 3, 'coding', 'seed'),
  ('Which HTML tag makes a clickable link?', 'mcq', '["<a>","<link>","<href>","<url>"]'::jsonb, '<a>', array[]::text[], 3, 'tech', 'seed'),
  ('What do you call software that protects a computer from viruses?', 'one_word', null, 'antivirus', array['anti-virus', 'antivirus software', 'anti virus']::text[], 3, 'tech', 'seed'),
  ('Who wrote "Romeo and Juliet"?', 'mcq', '["Rabindranath Tagore","Mark Twain","William Shakespeare","Charles Dickens"]'::jsonb, 'William Shakespeare', array[]::text[], 3, 'culture', 'seed'),
  ('What is the smallest prime number?', 'one_word', null, '2', array[]::text[], 3, 'math', 'seed'),
  ('Which country gave the Statue of Liberty to the USA?', 'mcq', '["France","United Kingdom","Spain","Italy"]'::jsonb, 'France', array[]::text[], 3, 'history', 'seed'),
  ('What is the capital of Australia?', 'one_word', null, 'Canberra', array[]::text[], 3, 'geography', 'seed'),
  ('How many bones does an adult human have?', 'one_word', null, '206', array[]::text[], 3, 'science', 'seed'),
  ('Which vitamin does your skin make in sunlight?', 'mcq', '["Vitamin C","Vitamin A","Vitamin B12","Vitamin D"]'::jsonb, 'Vitamin D', array[]::text[], 3, 'science', 'seed'),
  ('Which Indian city is called the Pink City?', 'one_word', null, 'Jaipur', array[]::text[], 3, 'geography', 'seed'),
  ('At what temperature in Celsius does water boil at sea level?', 'one_word', null, '100', array[]::text[], 3, 'science', 'seed'),
  ('Which planet is most famous for its rings?', 'mcq', '["Mercury","Venus","Saturn","Mars"]'::jsonb, 'Saturn', array[]::text[], 3, 'science', 'seed'),
  ('What is the longest bone in the human body?', 'one_word', null, 'femur', array['thigh bone', 'thighbone']::text[], 3, 'science', 'seed'),
  ('Who discovered penicillin?', 'mcq', '["Alexander Fleming","Isaac Newton","Thomas Edison","Marie Curie"]'::jsonb, 'Alexander Fleming', array[]::text[], 3, 'history', 'seed'),
  ('How many teeth does an adult human usually have?', 'one_word', null, '32', array[]::text[], 3, 'science', 'seed'),
  ('Who wrote the national anthem of India?', 'one_word', null, 'Rabindranath Tagore', array['tagore', 'rabindranath']::text[], 3, 'history', 'seed'),
  ('Which is the tallest mountain in the world?', 'mcq', '["K2","Kangchenjunga","Mount Kilimanjaro","Mount Everest"]'::jsonb, 'Mount Everest', array[]::text[], 3, 'geography', 'seed'),
  ('Which continent is the Sahara Desert in?', 'one_word', null, 'Africa', array[]::text[], 3, 'geography', 'seed'),
  ('How many players from one team are on a basketball court?', 'one_word', null, '5', array[]::text[], 3, 'sports', 'seed'),
  ('Which part of a plant makes food using sunlight?', 'mcq', '["Stem","Flower","Leaf","Root"]'::jsonb, 'Leaf', array[]::text[], 3, 'science', 'seed'),
  ('Which language has the most native speakers in the world?', 'one_word', null, 'Mandarin', array['chinese', 'mandarin chinese']::text[], 3, 'gk', 'seed'),
  ('How many degrees are in a right angle?', 'one_word', null, '90', array[]::text[], 3, 'math', 'seed'),
  ('Who was the first woman Prime Minister of India?', 'mcq', '["Sonia Gandhi","Indira Gandhi","Sarojini Naidu","Pratibha Patil"]'::jsonb, 'Indira Gandhi', array[]::text[], 3, 'history', 'seed'),
  ('In which country is the Eiffel Tower?', 'one_word', null, 'France', array[]::text[], 3, 'geography', 'seed'),
  ('What is 25% of 200?', 'one_word', null, '50', array[]::text[], 3, 'math', 'seed'),
  ('Which animal is the fastest on land?', 'mcq', '["Cheetah","Lion","Horse","Kangaroo"]'::jsonb, 'Cheetah', array[]::text[], 3, 'science', 'seed'),
  ('What is the name of the galaxy we live in?', 'one_word', null, 'Milky Way', array['the milky way', 'milkyway']::text[], 3, 'science', 'seed'),
  ('Which game has pieces called a rook and a bishop?', 'mcq', '["Ludo","Snakes and ladders","Chess","Carrom"]'::jsonb, 'Chess', array[]::text[], 3, 'sports', 'seed'),
  ('How many years are in a decade?', 'one_word', null, '10', array[]::text[], 3, 'gk', 'seed'),
  ('What is the largest organ of the human body?', 'mcq', '["Skin","Liver","Heart","Brain"]'::jsonb, 'Skin', array[]::text[], 3, 'science', 'seed'),
  ('Which Indian monument is famous as a symbol of love?', 'one_word', null, 'Taj Mahal', array['tajmahal', 'the taj', 'taj']::text[], 3, 'history', 'seed'),
  ('How many states of matter do we usually learn in school: solid, liquid and…?', 'one_word', null, '3', array[]::text[], 3, 'science', 'seed'),
  ('Which Indian festival is famous for throwing colours?', 'mcq', '["Diwali","Onam","Pongal","Holi"]'::jsonb, 'Holi', array[]::text[], 3, 'culture', 'seed'),
  ('What is the capital of the United Kingdom?', 'one_word', null, 'London', array[]::text[], 3, 'geography', 'seed'),
  ('How many seconds are in 3 minutes?', 'one_word', null, '180', array[]::text[], 3, 'math', 'seed'),
  ('The more you take, the more you leave behind. What are they?', 'one_word', null, 'footsteps', array['steps', 'footprints', 'foot steps']::text[], 3, 'riddle', 'seed'),
  ('What has many teeth but can''t bite?', 'one_word', null, 'comb', array['a comb']::text[], 3, 'riddle', 'seed'),
  ('You have 3 apples and take away 2. How many apples do you have?', 'one_word', null, '2', array[]::text[], 3, 'riddle', 'seed'),
  ('Finish the nerd joke: "There are 10 kinds of people: those who understand binary and…"', 'mcq', '["those who eat","those who don''t","those who code","those who sleep"]'::jsonb, 'those who don''t', array[]::text[], 3, 'meme', 'seed'),
  ('What has a neck but no head?', 'one_word', null, 'bottle', array['a bottle']::text[], 3, 'riddle', 'seed'),
  ('What does "LOL" usually mean in a chat?', 'mcq', '["Lots of love","Look online later","Leave our lobby","Laughing out loud"]'::jsonb, 'Laughing out loud', array[]::text[], 3, 'meme', 'seed'),
  ('A train leaves at 3 pm and the trip takes 2 hours. At what hour (pm) does it arrive?', 'one_word', null, '5', array[]::text[], 3, 'math', 'seed'),
  ('What word becomes shorter when you add two letters to it?', 'one_word', null, 'short', array[]::text[], 3, 'riddle', 'seed'),
  ('What does "BRB" mean in a chat?', 'mcq', '["Big red button","Bored, really bored","Be right back","Bring real bread"]'::jsonb, 'Be right back', array[]::text[], 3, 'meme', 'seed'),
  ('What can fill a room but takes up no space?', 'one_word', null, 'light', array['the light']::text[], 3, 'riddle', 'seed'),
  ('Which game made "Winner winner chicken dinner" famous with players?', 'mcq', '["PUBG","Minecraft","Tetris","Chess"]'::jsonb, 'PUBG', array[]::text[], 3, 'meme', 'seed'),
  ('What is the next number: 2, 4, 8, 16, …?', 'one_word', null, '32', array[]::text[], 3, 'math', 'seed'),
  ('Which famous puzzle is a cube with six coloured faces?', 'mcq', '["Jenga","Tangram","Rubik''s Cube","Sudoku"]'::jsonb, 'Rubik''s Cube', array[]::text[], 3, 'meme', 'seed'),
  ('What does this print?
def f(n):
    if n <= 1:
        return 1
    return n * f(n - 1)
print(f(4))', 'one_word', null, '24', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
x = [1, 2, 3]
y = x
y.append(4)
print(len(x))', 'mcq', '["4","3","Error","0"]'::jsonb, '4', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print(sum(range(1, 6)))', 'one_word', null, '15', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print([n * n for n in range(4)])', 'mcq', '["[0, 1, 2, 3]","[1, 2, 3, 4]","[0, 1, 4, 9]","[1, 4, 9, 16]"]'::jsonb, '[0, 1, 4, 9]', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
s = "level"
print(s == s[::-1])', 'one_word', null, 'True', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
d = {"a": 1, "b": 2}
d["a"] = 5
print(d["a"] + d["b"])', 'one_word', null, '7', array[]::text[], 4, 'coding', 'seed'),
  ('In JavaScript, what does this print?
console.log("3" * "4")', 'mcq', '["Error","12","34","NaN"]'::jsonb, '12', array[]::text[], 4, 'coding', 'seed'),
  ('Fix the bug: this should print 1 to 5 but stops at 4. What should the 5 become?
for i in range(1, 5):
    print(i)', 'one_word', null, '6', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
x = 0
for i in range(3):
    for j in range(2):
        x += 1
print(x)', 'one_word', null, '6', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print("Hi" + str(5))', 'mcq', '["Hi5","Hi 5","Error","5Hi"]'::jsonb, 'Hi5', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print(sorted(["pear", "apple", "fig"])[0])', 'one_word', null, 'apple', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print(2 ** 10)', 'one_word', null, '1024', array[]::text[], 4, 'coding', 'seed'),
  ('What does this print?
print("abc" * 0)', 'mcq', '["abc","0","Error","An empty line"]'::jsonb, 'An empty line', array[]::text[], 4, 'coding', 'seed'),
  ('How fast is binary search on a sorted list of n items?', 'mcq', '["O(log n)","O(n)","O(1)","O(n²)"]'::jsonb, 'O(log n)', array[]::text[], 4, 'tech', 'seed'),
  ('Which port does HTTPS use by default?', 'one_word', null, '443', array[]::text[], 4, 'tech', 'seed'),
  ('A DNS server turns a website name into what?', 'one_word', null, 'IP address', array['ip', 'an ip address', 'ip addresses']::text[], 4, 'tech', 'seed'),
  ('Which language runs natively inside web browsers?', 'mcq', '["Python","C++","Java","JavaScript"]'::jsonb, 'JavaScript', array[]::text[], 4, 'tech', 'seed'),
  ('Which data structure is "last in, first out"?', 'mcq', '["Stack","Queue","Linked list","Hash map"]'::jsonb, 'Stack', array[]::text[], 4, 'tech', 'seed'),
  ('What is the name of the penguin mascot of Linux?', 'one_word', null, 'Tux', array[]::text[], 4, 'tech', 'seed'),
  ('What is the binary number 1111 in decimal?', 'one_word', null, '15', array[]::text[], 4, 'tech', 'seed'),
  ('In Git, which command saves your staged changes as a snapshot?', 'mcq', '["git commit","git push","git pull","git clone"]'::jsonb, 'git commit', array[]::text[], 4, 'tech', 'seed'),
  ('Which shortcut takes a screenshot of the whole screen on Windows 10 and 11?', 'mcq', '["Alt + F4","Ctrl + P","Windows + PrtScn","Ctrl + S"]'::jsonb, 'Windows + PrtScn', array[]::text[], 4, 'tech', 'seed'),
  ('Who was the first person to walk on the Moon?', 'mcq', '["Buzz Aldrin","Yuri Gagarin","Rakesh Sharma","Neil Armstrong"]'::jsonb, 'Neil Armstrong', array[]::text[], 4, 'history', 'seed'),
  ('In which year did World War II end?', 'one_word', null, '1945', array[]::text[], 4, 'history', 'seed'),
  ('What is the capital of Canada?', 'one_word', null, 'Ottawa', array[]::text[], 4, 'geography', 'seed'),
  ('Which element has the chemical symbol Fe?', 'mcq', '["Lead","Silver","Iron","Fluorine"]'::jsonb, 'Iron', array[]::text[], 4, 'science', 'seed'),
  ('Who is known as the Missile Man of India?', 'one_word', null, 'APJ Abdul Kalam', array['kalam', 'abdul kalam', 'a p j abdul kalam', 'a.p.j. abdul kalam', 'apj kalam']::text[], 4, 'history', 'seed'),
  ('How many small squares are on a chess board?', 'one_word', null, '64', array[]::text[], 4, 'sports', 'seed'),
  ('Which is the largest hot desert in the world?', 'mcq', '["Kalahari","Sahara","Thar","Gobi"]'::jsonb, 'Sahara', array[]::text[], 4, 'geography', 'seed'),
  ('Which Mughal emperor built the Taj Mahal?', 'one_word', null, 'Shah Jahan', array['shahjahan']::text[], 4, 'history', 'seed'),
  ('About how fast does light travel?', 'mcq', '["3,000 km per second","30 km per second","3 km per second","300,000 km per second"]'::jsonb, '300,000 km per second', array[]::text[], 4, 'science', 'seed'),
  ('How many strings does a standard guitar have?', 'one_word', null, '6', array[]::text[], 4, 'culture', 'seed'),
  ('Which country has the most people in the world?', 'mcq', '["Indonesia","India","China","United States"]'::jsonb, 'India', array[]::text[], 4, 'geography', 'seed'),
  ('What is the square root of 144?', 'one_word', null, '12', array[]::text[], 4, 'math', 'seed'),
  ('Which planet is often called the Morning Star?', 'one_word', null, 'Venus', array[]::text[], 4, 'science', 'seed'),
  ('Who invented the telephone?', 'mcq', '["Alexander Graham Bell","Thomas Edison","Nikola Tesla","Guglielmo Marconi"]'::jsonb, 'Alexander Graham Bell', array[]::text[], 4, 'history', 'seed'),
  ('How many players from one team are on the field in hockey?', 'one_word', null, '11', array[]::text[], 4, 'sports', 'seed'),
  ('What is the capital of Germany?', 'one_word', null, 'Berlin', array[]::text[], 4, 'geography', 'seed'),
  ('What does a thermometer measure?', 'mcq', '["Pressure","Speed","Weight","Temperature"]'::jsonb, 'Temperature', array[]::text[], 4, 'science', 'seed'),
  ('How many zeros are in one lakh?', 'one_word', null, '5', array[]::text[], 4, 'math', 'seed'),
  ('Who said "Give me blood, and I will give you freedom"?', 'one_word', null, 'Subhas Chandra Bose', array['bose', 'netaji', 'subhash chandra bose', 'subhas bose', 'netaji subhas chandra bose']::text[], 4, 'history', 'seed'),
  ('Which gas makes up most of the air on Earth?', 'mcq', '["Carbon dioxide","Argon","Nitrogen","Oxygen"]'::jsonb, 'Nitrogen', array[]::text[], 4, 'science', 'seed'),
  ('Which scientist gave the three laws of motion?', 'one_word', null, 'Isaac Newton', array['newton', 'sir isaac newton']::text[], 4, 'history', 'seed'),
  ('How many minutes are in a day?', 'one_word', null, '1440', array[]::text[], 4, 'math', 'seed'),
  ('Which Indian state is famous for backwaters and houseboats?', 'mcq', '["Gujarat","Kerala","Goa","Punjab"]'::jsonb, 'Kerala', array[]::text[], 4, 'geography', 'seed'),
  ('In which country did chess begin, as chaturanga?', 'one_word', null, 'India', array[]::text[], 4, 'history', 'seed'),
  ('What is Jupiter''s famous giant storm called?', 'mcq', '["The Big Blue Eye","The Dark Ring","The White Whirl","The Great Red Spot"]'::jsonb, 'The Great Red Spot', array[]::text[], 4, 'science', 'seed'),
  ('What can travel around the world while staying in a corner?', 'one_word', null, 'stamp', array['a stamp', 'postage stamp']::text[], 4, 'riddle', 'seed'),
  ('A farmer has 17 sheep. All but 9 run away. How many are left?', 'one_word', null, '9', array[]::text[], 4, 'riddle', 'seed'),
  ('"Have you tried turning it off and on again?" is the famous line from which TV show?', 'mcq', '["Sherlock","The Office","The IT Crowd","Friends"]'::jsonb, 'The IT Crowd', array[]::text[], 4, 'meme', 'seed'),
  ('What has words but never speaks?', 'one_word', null, 'book', array['a book']::text[], 4, 'riddle', 'seed'),
  ('In a meme, what does "404: brain not found" mean?', 'mcq', '["Someone can''t think right now","A website is very fast","The internet is free today","A phone is brand new"]'::jsonb, 'Someone can''t think right now', array[]::text[], 4, 'meme', 'seed'),
  ('What is the next number: 1, 1, 2, 3, 5, 8, …?', 'one_word', null, '13', array[]::text[], 4, 'math', 'seed'),
  ('What has a ring but no finger?', 'one_word', null, 'phone', array['a phone', 'telephone', 'bell', 'a bell']::text[], 4, 'riddle', 'seed'),
  ('Which dog breed stars in the "Doge" meme?', 'mcq', '["Pug","Labrador","Husky","Shiba Inu"]'::jsonb, 'Shiba Inu', array[]::text[], 4, 'meme', 'seed'),
  ('5 machines make 5 toys in 5 minutes. How many minutes do 100 machines take to make 100 toys?', 'one_word', null, '5', array[]::text[], 4, 'riddle', 'seed'),
  ('What comes once in a minute, twice in a moment, but never in a thousand years?', 'one_word', null, 'm', array['the letter m', 'letter m']::text[], 4, 'riddle', 'seed'),
  ('I''m light as a feather, yet the strongest person can''t hold me for five minutes. What am I?', 'one_word', null, 'breath', array['your breath', 'a breath']::text[], 4, 'riddle', 'seed'),
  ('What does this print?
def f(n):
    return n if n < 2 else f(n - 1) + f(n - 2)
print(f(7))', 'one_word', null, '13', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
a = [1, 2, 3]
b = a[:]
b.append(4)
print(len(a), len(b))', 'mcq', '["3 4","4 4","3 3","4 3"]'::jsonb, '3 4', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
x = 10
def change():
    x = 5
change()
print(x)', 'one_word', null, '10', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print({1, 2, 2, 3})', 'mcq', '["[1, 2, 3]","Error","{1, 2, 3}","{1, 2, 2, 3}"]'::jsonb, '{1, 2, 3}', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print(len({"a": 1, "b": 2, "a": 3}))', 'one_word', null, '2', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print("Hello World".split()[1][::-1])', 'one_word', null, 'dlroW', array[]::text[], 5, 'coding', 'seed'),
  ('In JavaScript, what does this print?
console.log(0.1 + 0.2 === 0.3)', 'mcq', '["Error","false","true","undefined"]'::jsonb, 'false', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
nums = [1, 2, 3, 4, 5, 6]
print(sum(n for n in nums if n % 3 == 0))', 'one_word', null, '9', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print(type([]) == type(()))', 'mcq', '["True","Error","None","False"]'::jsonb, 'False', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
s = 0
for i in range(10):
    if i == 5:
        break
    s += i
print(s)', 'one_word', null, '10', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print("abc"[1:])', 'one_word', null, 'bc', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print(int("1010", 2))', 'one_word', null, '10', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print([0] * 3)', 'mcq', '["[0]","[3]","0003","[0, 0, 0]"]'::jsonb, '[0, 0, 0]', array[]::text[], 5, 'coding', 'seed'),
  ('Fix the bug: this crashes. Which line prints the last number instead?
nums = [1, 2, 3]
print(nums[3])', 'mcq', '["print(nums[2])","print(nums(3))","print(nums{3})","print(nums.3)"]'::jsonb, 'print(nums[2])', array[]::text[], 5, 'coding', 'seed'),
  ('What does this print?
print(len(str(2 ** 10)))', 'one_word', null, '4', array[]::text[], 5, 'coding', 'seed'),
  ('What does an HTTP 500 error mean?', 'mcq', '["You are not logged in","The page loaded fine","Something broke on the server","The page was moved"]'::jsonb, 'Something broke on the server', array[]::text[], 5, 'tech', 'seed'),
  ('What does API stand for?', 'one_word', null, 'Application Programming Interface', array['application program interface']::text[], 5, 'tech', 'seed'),
  ('Which sorting method keeps swapping neighbouring items until the list is in order?', 'mcq', '["Bubble sort","Merge sort","Quick sort","Heap sort"]'::jsonb, 'Bubble sort', array[]::text[], 5, 'tech', 'seed'),
  ('How many layers does the OSI network model have?', 'one_word', null, '7', array[]::text[], 5, 'tech', 'seed'),
  ('On average, how long does looking up a key in a hash map take?', 'mcq', '["O(log n)","O(n log n)","O(1)","O(n)"]'::jsonb, 'O(1)', array[]::text[], 5, 'tech', 'seed'),
  ('Which company first created the Java language?', 'one_word', null, 'Sun Microsystems', array['sun', 'sun micro systems']::text[], 5, 'tech', 'seed'),
  ('Which of these is NOT a standard HTTP method?', 'mcq', '["FETCH","GET","POST","DELETE"]'::jsonb, 'FETCH', array[]::text[], 5, 'tech', 'seed'),
  ('What is the hexadecimal number FF in decimal?', 'one_word', null, '255', array[]::text[], 5, 'tech', 'seed'),
  ('What do we call fake messages that trick you into giving away your password?', 'one_word', null, 'phishing', array['phishing attack', 'fishing']::text[], 5, 'tech', 'seed'),
  ('What does "open source" software mean?', 'mcq', '["It never has bugs","It only runs on Linux","Nobody is allowed to change it","Its code is public for anyone to read and improve"]'::jsonb, 'Its code is public for anyone to read and improve', array[]::text[], 5, 'tech', 'seed'),
  ('Who gave the theory of relativity?', 'mcq', '["Albert Einstein","Isaac Newton","Stephen Hawking","Galileo Galilei"]'::jsonb, 'Albert Einstein', array[]::text[], 5, 'science', 'seed'),
  ('What is the capital of Brazil?', 'one_word', null, 'Brasilia', array[]::text[], 5, 'geography', 'seed'),
  ('How many hearts does an octopus have?', 'one_word', null, '3', array[]::text[], 5, 'science', 'seed'),
  ('Which Indian mathematician is linked to the famous number 1729?', 'mcq', '["Aryabhata","Bhaskara","Brahmagupta","Srinivasa Ramanujan"]'::jsonb, 'Srinivasa Ramanujan', array[]::text[], 5, 'history', 'seed'),
  ('In which year did the Constitution of India come into effect?', 'one_word', null, '1950', array[]::text[], 5, 'history', 'seed'),
  ('Which planet spins tipped over on its side?', 'mcq', '["Neptune","Uranus","Venus","Mars"]'::jsonb, 'Uranus', array[]::text[], 5, 'science', 'seed'),
  ('Which metal is a liquid at room temperature?', 'one_word', null, 'mercury', array[]::text[], 5, 'science', 'seed'),
  ('How many players from one team are on a volleyball court?', 'one_word', null, '6', array[]::text[], 5, 'sports', 'seed'),
  ('Which is the smallest country in the world?', 'mcq', '["Vatican City","Monaco","Malta","Maldives"]'::jsonb, 'Vatican City', array[]::text[], 5, 'geography', 'seed'),
  ('In which city were the first modern Olympic Games held, in 1896?', 'one_word', null, 'Athens', array[]::text[], 5, 'history', 'seed'),
  ('Who was the first Indian to win a Nobel Prize?', 'mcq', '["Mother Teresa","Amartya Sen","Rabindranath Tagore","C. V. Raman"]'::jsonb, 'Rabindranath Tagore', array[]::text[], 5, 'history', 'seed'),
  ('In which year did Chandrayaan-3 land on the Moon?', 'one_word', null, '2023', array[]::text[], 5, 'science', 'seed'),
  ('Which is the largest country in the world by area?', 'one_word', null, 'Russia', array[]::text[], 5, 'geography', 'seed'),
  ('Which of the Seven Wonders of the Ancient World still stands?', 'mcq', '["The Lighthouse of Alexandria","The Great Pyramid of Giza","The Hanging Gardens of Babylon","The Colossus of Rhodes"]'::jsonb, 'The Great Pyramid of Giza', array[]::text[], 5, 'history', 'seed'),
  ('How many time zones does India officially use?', 'one_word', null, '1', array[]::text[], 5, 'geography', 'seed'),
  ('Which Indian scientist won the Nobel Prize for the scattering of light?', 'one_word', null, 'C V Raman', array['raman', 'cv raman', 'c.v. raman', 'c. v. raman', 'chandrasekhara venkata raman']::text[], 5, 'history', 'seed'),
  ('Which part is called "the powerhouse of the cell"?', 'mcq', '["Mitochondria","Nucleus","Ribosome","Cell wall"]'::jsonb, 'Mitochondria', array[]::text[], 5, 'science', 'seed'),
  ('How many sides does a decagon have?', 'one_word', null, '10', array[]::text[], 5, 'math', 'seed'),
  ('Which famous ship sank in 1912 after hitting an iceberg?', 'one_word', null, 'Titanic', array['the titanic', 'rms titanic']::text[], 5, 'history', 'seed'),
  ('Which space agency launched Mangalyaan to Mars?', 'mcq', '["NASA","DRDO","ESA","ISRO"]'::jsonb, 'ISRO', array[]::text[], 5, 'science', 'seed'),
  ('What is 17 × 6?', 'one_word', null, '102', array[]::text[], 5, 'math', 'seed'),
  ('Which blood group is known as the universal donor?', 'one_word', null, 'O negative', array['o-', 'o neg', 'onegative', 'o -ve', 'o-ve', 'o negative blood']::text[], 5, 'science', 'seed'),
  ('Which emperor gave up war after the Kalinga war?', 'mcq', '["Chandragupta Maurya","Harsha","Ashoka","Akbar"]'::jsonb, 'Ashoka', array[]::text[], 5, 'history', 'seed'),
  ('Which word is spelled wrong in every dictionary?', 'one_word', null, 'wrong', array[]::text[], 5, 'riddle', 'seed'),
  ('If two''s company and three''s a crowd, what are four and five?', 'one_word', null, '9', array[]::text[], 5, 'riddle', 'seed'),
  ('I speak without a mouth and hear without ears. What am I?', 'one_word', null, 'echo', array['an echo']::text[], 5, 'riddle', 'seed'),
  ('A bat and a ball cost ₹110 together. The bat costs ₹100 more than the ball. How much is the ball?', 'mcq', '["₹100","₹1","₹5","₹10"]'::jsonb, '₹5', array[]::text[], 5, 'riddle', 'seed'),
  ('A snail climbs 3 m up a 10 m well each day and slips back 2 m each night. On which day does it reach the top?', 'one_word', null, '8', array[]::text[], 5, 'riddle', 'seed'),
  ('Which place completes the meme "One does not simply walk into…"?', 'mcq', '["Mordor","Hogwarts","Narnia","Gotham"]'::jsonb, 'Mordor', array[]::text[], 5, 'meme', 'seed'),
  ('What is always in front of you but can''t be seen?', 'one_word', null, 'future', array['the future']::text[], 5, 'riddle', 'seed'),
  ('In the "This is fine" meme, where is the dog sitting?', 'mcq', '["In a spaceship","In a traffic jam","In a room on fire","In a swimming pool"]'::jsonb, 'In a room on fire', array[]::text[], 5, 'meme', 'seed'),
  ('How many times can you subtract 5 from 25?', 'one_word', null, '1', array[]::text[], 5, 'riddle', 'seed'),
  ('What has cities but no houses, forests but no trees, and water but no fish?', 'one_word', null, 'map', array['a map']::text[], 5, 'riddle', 'seed')
) as v(text, type, options, answer, alternatives, difficulty, topic, source)
where not exists (select 1 from public.questions q where q.text = v.text);
