const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "../../documents");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, "Operating_Systems_Unit_1.pdf");
const doc = new PDFDocument({ margin: 50 });

doc.pipe(fs.createWriteStream(outputPath));

// Page 1
doc.fontSize(22).font("Helvetica-Bold").text("Course: B.Tech Computer Science");
doc.fontSize(16).text("Subject: Operating Systems (CS301)");
doc.fontSize(14).text("Unit 1: Introduction to Operating Systems\n\n");

doc.fontSize(16).font("Helvetica-Bold").text("What is an Operating System?");
doc.fontSize(12).font("Helvetica").text(
  "An operating system is system software that manages computer hardware and provides common services for application programs. It acts as an intermediary between the user of a computer and the computer hardware. The primary goal of an operating system is to make the computer system convenient to use, and to use the computer hardware in an efficient manner.\n\n"
);

doc.fontSize(14).font("Helvetica-Bold").text("Dual-Mode Operation");
doc.fontSize(12).font("Helvetica").text(
  "To ensure the proper execution of the operating system, we must distinguish between the execution of user code and operating-system code. Computer systems provide hardware support that allows differentiation among various modes of execution, specifically User Mode and Kernel (Privileged) Mode."
);

// Page 2
doc.addPage();
doc.fontSize(18).font("Helvetica-Bold").text("Page 2: Core Functions of an Operating System\n\n");

doc.fontSize(13).font("Helvetica-Bold").text("1. Process Management");
doc.fontSize(11).font("Helvetica").text("The OS allocates processor time to active processes, handles context switching, and manages process synchronization and deadlock prevention.\n\n");

doc.fontSize(13).font("Helvetica-Bold").text("2. Memory Management");
doc.fontSize(11).font("Helvetica").text("The OS tracks which parts of memory are currently being used, decides which processes are loaded into memory when space becomes available, and allocates and deallocates memory space as needed.\n\n");

doc.fontSize(13).font("Helvetica-Bold").text("3. File System Management");
doc.fontSize(11).font("Helvetica").text("Provides uniform logical view of information storage by abstracting physical properties of storage devices into logical storage units known as files and directories.\n\n");

doc.fontSize(13).font("Helvetica-Bold").text("4. I/O System Management");
doc.fontSize(11).font("Helvetica").text("Hides peculiarities of specific hardware devices from the user through buffering, caching, spooling, and general device-driver interfaces.");

// Page 3
doc.addPage();
doc.fontSize(18).font("Helvetica-Bold").text("Page 3: Process Concepts & Execution\n\n");

doc.fontSize(14).font("Helvetica-Bold").text("What is a Process?");
doc.fontSize(12).font("Helvetica").text(
  "A process is a program in execution. A program by itself is only a passive entity (such as a file containing a list of instructions stored on disk), whereas a process is an active entity, with a program counter specifying the next instruction to execute and a set of associated system resources.\n\n"
);

doc.fontSize(14).font("Helvetica-Bold").text("Simple Example");
doc.fontSize(12).font("Helvetica").text(
  "When you double-click or open a calculator application, the operating system reads the program code from storage, loads it into memory, creates a Process Control Block (PCB), and schedules it on the CPU. The running calculator is an active process."
);

doc.end();
console.log("Created selectable PDF:", outputPath);
