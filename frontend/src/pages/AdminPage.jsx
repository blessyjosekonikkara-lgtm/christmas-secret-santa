import React, { useEffect, useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  TableContainer, 
  Chip, 
  TextField, 
  InputAdornment, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Alert, 
  IconButton,
  Tabs,
  Tab
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SecurityIcon from "@mui/icons-material/Security";
import { useAuth } from "../context/AuthContext";
import { secretSantaService } from "../services/secretSantaService";
import { ADMIN_EMAIL } from "../config/participants";

export default function AdminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [tabFilter, setTabFilter] = useState("ALL");

  // Modals
  const [showMatrix, setShowMatrix] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editName, setEditName] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingParticipant, setDeletingParticipant] = useState(null);

  const [confirmLockModalOpen, setConfirmLockModalOpen] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);

  const isAdmin = user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Safe check to ensure the 45 participants are seeded in MongoDB if empty
      await secretSantaService.initializeParticipantsIfEmpty(user);
      const overview = await secretSantaService.getAdminOverview("production", user);
      setData(overview);
    } catch (err) {
      setError(err.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
      // Attach real-time listener for live registration updates
      const unsubscribe = secretSantaService.subscribeAdminOverview((liveOverview) => {
        setData(liveOverview);
        setLoading(false);
      }, "production", user);

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, [isAdmin]);

  const handleSyncLocalRegistrations = async () => {
    setSyncingLocal(true);
    setError("");
    try {
      const res = await secretSantaService.syncLocalRegistrationsToFirestore(user, "production");
      if (res.syncedCount > 0) {
        setSuccessMessage(`Successfully recovered and synced ${res.syncedCount} member(s): ${res.recoveredMembers.join(", ")}`);
      } else {
        setSuccessMessage("All local registrations on this device are already synced to the Central Cloud.");
      }
      await loadData();
    } catch (e) {
      setError(e.message || "Could not sync local registrations.");
    } finally {
      setSyncingLocal(false);
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: "center", background: "#FFFFFF", border: "2px solid #C41E3A", borderRadius: 4 }}>
          <SecurityIcon sx={{ fontSize: 60, color: "#C41E3A", mb: 2 }} />
          <Typography variant="h5" sx={{ color: "#78350F", fontWeight: 800, mb: 1 }}>
            Access Restricted
          </Typography>
          <Typography variant="body1" sx={{ color: "#57534E" }}>
            The Admin Dashboard is strictly restricted to the authorized administrator (<strong>{ADMIN_EMAIL}</strong>).
          </Typography>
        </Paper>
      </Box>
    );
  }

  // 1. Add Participant
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError("");
    try {
      await secretSantaService.addParticipant(newName.trim(), "production");
      setSuccessMessage(`Participant "${newName.trim()}" added successfully.`);
      setAddModalOpen(false);
      setNewName("");
      loadData();
    } catch (err) {
      setError(err.message || "Failed to add participant.");
    }
  };

  // 2. Edit Participant
  const handleEditOpen = (p) => {
    setEditingParticipant(p);
    setEditName(p.officialName);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editingParticipant) return;

    setError("");
    try {
      await secretSantaService.editParticipant(editingParticipant.id, editName.trim(), "production");
      setSuccessMessage(`Participant renamed to "${editName.trim()}".`);
      setEditModalOpen(false);
      setEditingParticipant(null);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to edit participant.");
    }
  };

  // 3. Delete Participant
  const handleDeleteOpen = (p) => {
    setDeletingParticipant(p);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingParticipant) return;

    setError("");
    try {
      await secretSantaService.deleteParticipant(deletingParticipant.id, "production");
      setSuccessMessage(`Participant "${deletingParticipant.officialName}" removed.`);
      setDeleteModalOpen(false);
      setDeletingParticipant(null);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete participant.");
    }
  };

  // 4. Generate Assignments
  const handleGenerateAssignments = async () => {
    setError("");
    try {
      const res = await secretSantaService.generateAssignments("production", user);
      setSuccessMessage(`Generated ${res.totalPairs || res.totalAssignments || 45} unique Secret Santa assignments using Fisher-Yates derangement!`);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to generate assignments.");
    }
  };

  // 5. Lock Assignments Permanently
  const handleLockAssignments = async () => {
    setError("");
    try {
      await secretSantaService.lockAssignments("production", user);
      setSuccessMessage("All assignments are now PERMANENTLY LOCKED. No further regeneration is possible.");
      setConfirmLockModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to lock assignments.");
    }
  };

  // 6. Reset Registrations Environment
  const handleResetRegistrations = async () => {
    if (window.confirm("Are you sure you want to reset all participant registrations and assignments? All 46 participants will return to PENDING.")) {
      setError("");
      try {
        await secretSantaService.resetTestingEnvironment();
        setSuccessMessage("Official family roster reset successfully. All 46 participants are PENDING.");
        loadData();
      } catch (err) {
        setError(err.message || "Failed to reset participants.");
      }
    }
  };

  // Filter participants
  const filteredParticipants = (data?.participants || []).filter((p) => {
    const matchesSearch = 
      p.officialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.registeredByEmail && p.registeredByEmail.toLowerCase().includes(searchTerm.toLowerCase()));

    if (tabFilter === "REGISTERED") return matchesSearch && p.status === "REGISTERED";
    if (tabFilter === "PENDING") return matchesSearch && p.status === "PENDING";
    return matchesSearch;
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 4 }}>
      {/* Admin Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h4" sx={{ color: "#78350F", fontWeight: 900, letterSpacing: 1 }}>
              🎅 Admin Secret Santa Console
            </Typography>
            <Chip 
              label={data?.isCentral ? "Central Cloud Live ☁️" : "Local Backup"} 
              size="small" 
              sx={{ 
                bgcolor: data?.isCentral ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: data?.isCentral ? "#065F46" : "#92400E",
                fontWeight: 800,
                border: "1px solid",
                borderColor: data?.isCentral ? "#10B981" : "#F59E0B"
              }} 
            />
          </Box>
          <Typography variant="body2" sx={{ color: "#57534E" }}>
            Administrator: <strong>{ADMIN_EMAIL}</strong>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            onClick={handleSyncLocalRegistrations}
            disabled={syncingLocal}
            sx={{
              fontWeight: 800,
              borderColor: "#10B981",
              color: "#065F46",
              bgcolor: "rgba(16, 185, 129, 0.08)",
              "&:hover": { bgcolor: "rgba(16, 185, 129, 0.15)", borderColor: "#059669" }
            }}
          >
            {syncingLocal ? "Syncing..." : "Sync Device Records ☁️"}
          </Button>

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAddModalOpen(true)}
            sx={{
              fontWeight: 800,
              background: "linear-gradient(135deg, #FDE68A, #D4AF37)",
              color: "#452C06",
            }}
          >
            Add Participant
          </Button>

          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={loadData}
            sx={{ borderColor: "#D4AF37", color: "#78350F", fontWeight: 700 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccessMessage("")}>
          {successMessage}
        </Alert>
      )}

      {/* Metric Cards Grid */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: "rgba(255, 255, 255, 0.9)", border: "1.5px solid #D4AF37", textAlign: "center", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h3" sx={{ color: "#78350F", fontWeight: 800 }}>
                {data?.totalInDb || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#78716C", fontWeight: 700 }}>
                TOTAL PARTICIPANTS
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: "rgba(236, 253, 245, 0.9)", border: "1.5px solid #10B981", textAlign: "center", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h3" sx={{ color: "#065F46", fontWeight: 800 }}>
                {data?.registeredCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#065F46", fontWeight: 700 }}>
                REGISTERED MEMBERS
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: "rgba(254, 243, 199, 0.9)", border: "1.5px solid #F59E0B", textAlign: "center", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h3" sx={{ color: "#92400E", fontWeight: 800 }}>
                {data?.pendingCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#92400E", fontWeight: 700 }}>
                PENDING MEMBERS
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: "rgba(239, 246, 255, 0.9)", border: "1.5px solid #3B82F6", textAlign: "center", borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h3" sx={{ color: "#1E40AF", fontWeight: 800 }}>
                {data?.uniqueVerifiedEmailsCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#1E40AF", fontWeight: 700 }}>
                VERIFIED ACCOUNTS
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ 
            background: data?.assignmentsLocked ? "rgba(254, 226, 226, 0.9)" : "rgba(253, 248, 237, 0.9)", 
            border: data?.assignmentsLocked ? "1.5px solid #C41E3A" : "1.5px solid #D4AF37", 
            textAlign: "center",
            borderRadius: 3
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: data?.assignmentsLocked ? "#991B1B" : "#78350F", fontWeight: 800, mt: 1 }}>
                {data?.assignmentsLocked ? "LOCKED 🔒" : data?.assignmentsGenerated ? "GENERATED" : "NOT READY"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#78716C", fontWeight: 700 }}>
                ASSIGNMENT STATUS
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Assignment Management Bar */}
      <Paper sx={{ p: 3, mb: 4, background: "rgba(255, 255, 255, 0.92)", border: "1.5px solid rgba(212, 175, 55, 0.5)", borderRadius: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: "#78350F", fontWeight: 800 }}>
              Assignment Management
            </Typography>
            <Typography variant="body2" sx={{ color: "#57534E" }}>
              {data?.assignmentsLocked 
                ? "Assignments are permanently locked. Pairings cannot be reshuffled."
                : data?.assignmentsGenerated
                  ? "Assignments are generated. Review below, then lock permanently when ready."
                  : "All assignments will be generated together using cryptographically secure derangement."}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {!data?.assignmentsLocked && (
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerateAssignments}
                disabled={loading}
                sx={{
                  background: "linear-gradient(135deg, #FDE68A, #D4AF37)",
                  color: "#452C06",
                  fontWeight: 800,
                }}
              >
                {data?.assignmentsGenerated ? "Regenerate Assignments" : "Generate Assignments"}
              </Button>
            )}

            {data?.assignmentsGenerated && !data?.assignmentsLocked && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<LockIcon />}
                onClick={() => setConfirmLockModalOpen(true)}
                sx={{ fontWeight: 800 }}
              >
                Lock Permanently
              </Button>
            )}

            {data?.assignmentsGenerated && (
              <Button
                variant="outlined"
                startIcon={showMatrix ? <VisibilityOffIcon /> : <VisibilityIcon />}
                onClick={() => setShowMatrix(!showMatrix)}
                sx={{ borderColor: "#D4AF37", color: "#78350F", fontWeight: 700 }}
              >
                {showMatrix ? "Hide Matrix" : "View Full Assignment Matrix"}
              </Button>
            )}

            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleResetRegistrations}
              disabled={loading}
              sx={{ borderColor: "#F59E0B", color: "#92400E", fontWeight: 700 }}
            >
              Reset Registrations
            </Button>
          </Box>
        </Box>

        {/* Private Complete Assignment Matrix View (Admin Only) */}
        {showMatrix && data?.assignments && data.assignments.length > 0 && (
          <Box sx={{ mt: 3, pt: 3, borderTop: "1px dashed rgba(212, 175, 55, 0.4)" }}>
            <Typography variant="subtitle1" sx={{ color: "#78350F", fontWeight: 800, mb: 1.5 }}>
              🔒 Complete Secret Santa Mapping (Confidential Admin View - {data.assignments.length} pairs):
            </Typography>
            <Grid container spacing={1.5}>
              {data.assignments.map((pair, idx) => (
                <Grid item xs={12} sm={6} md={4} key={pair.giverId || idx}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: "rgba(253, 248, 237, 0.9)",
                      border: "1px solid rgba(212, 175, 55, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "#1C1917", fontWeight: 700 }}>
                      🎁 {pair.giverName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#B45309", fontWeight: 800 }}>
                      ➔ 🎅 {pair.receiverName}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Participant Directory Table */}
      <Paper sx={{ p: 3, background: "rgba(255, 255, 255, 0.92)", border: "1.5px solid rgba(212, 175, 55, 0.5)", borderRadius: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Typography variant="h6" sx={{ color: "#78350F", fontWeight: 800 }}>
            Official Participant Roster ({filteredParticipants.length})
          </Typography>

          <TextField
            size="small"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#D4AF37" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: "100%", sm: 300 },
              "& .MuiOutlinedInput-root": { backgroundColor: "#FFFFFF", borderRadius: 2 },
            }}
          />
        </Box>

        <Tabs
          value={tabFilter}
          onChange={(e, val) => setTabFilter(val)}
          sx={{ mb: 2, borderBottom: "1px solid rgba(212, 175, 55, 0.2)" }}
          textColor="secondary"
          indicatorColor="secondary"
        >
          <Tab label={`All (${data?.totalInDb || 0})`} value="ALL" sx={{ fontWeight: 700, color: "#78350F" }} />
          <Tab label={`Registered (${data?.registeredCount || 0})`} value="REGISTERED" sx={{ fontWeight: 700, color: "#78350F" }} />
          <Tab label={`Pending (${data?.pendingCount || 0})`} value="PENDING" sx={{ fontWeight: 700, color: "#78350F" }} />
        </Tabs>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }}>S.No</TableCell>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }}>Participant Name</TableCell>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }}>Linked Email Account</TableCell>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }}>Registration Date</TableCell>
                <TableCell sx={{ backgroundColor: "#FDF8ED", color: "#78350F", fontWeight: 800 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParticipants.map((p, idx) => (
                <TableRow key={p.id} hover sx={{ "&:hover": { backgroundColor: "rgba(253, 248, 237, 0.6)" } }}>
                  <TableCell sx={{ color: "#78716C" }}>{idx + 1}</TableCell>
                  <TableCell sx={{ color: "#1C1917", fontWeight: 700 }}>{p.officialName}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={p.status}
                      color={p.status === "REGISTERED" ? "success" : "default"}
                      sx={{
                        fontWeight: 700,
                        backgroundColor: p.status === "REGISTERED" ? "#ECFDF5" : "#F5F5F4",
                        color: p.status === "REGISTERED" ? "#065F46" : "#78716C",
                        border: p.status === "REGISTERED" ? "1px solid #10B981" : "1px solid #D6D3D1",
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: p.registeredByEmail ? "#78350F" : "#A8A29E", fontWeight: p.registeredByEmail ? 600 : 400 }}>
                    {p.registeredByEmail || "Not Registered Yet"}
                  </TableCell>
                  <TableCell sx={{ color: "#78716C" }}>
                    {p.registeredAt ? new Date(p.registeredAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditOpen(p)} sx={{ color: "#3B82F6", mr: 1 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteOpen(p)} sx={{ color: "#EF4444" }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Participant Modal */}
      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <form onSubmit={handleAddSubmit}>
          <DialogTitle sx={{ background: "#FFFFFF", color: "#78350F", fontWeight: 800 }}>
            Add Family Member
          </DialogTitle>
          <DialogContent sx={{ background: "#FFFFFF", pt: 2 }}>
            <Typography variant="body2" sx={{ color: "#57534E", mb: 2 }}>
              Add a new family participant to the Secret Santa exchange.
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Participant Official Name"
              placeholder="e.g. GRANDMA MARY"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ background: "#FFFFFF", px: 3, pb: 2 }}>
            <Button onClick={() => setAddModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ background: "linear-gradient(135deg, #FDE68A, #D4AF37)", color: "#452C06", fontWeight: 800 }}>
              Add Participant
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Participant Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ background: "#FFFFFF", color: "#78350F", fontWeight: 800 }}>
            Edit Participant Name
          </DialogTitle>
          <DialogContent sx={{ background: "#FFFFFF", pt: 2 }}>
            <Typography variant="body2" sx={{ color: "#57534E", mb: 2 }}>
              Update the spelling or official name for this participant.
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Official Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ background: "#FFFFFF", px: 3, pb: 2 }}>
            <Button onClick={() => setEditModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ background: "linear-gradient(135deg, #FDE68A, #D4AF37)", color: "#452C06", fontWeight: 800 }}>
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle sx={{ background: "#FFFFFF", color: "#DC2626", fontWeight: 800 }}>
          Confirm Delete Participant
        </DialogTitle>
        <DialogContent sx={{ background: "#FFFFFF", pt: 2 }}>
          <Typography variant="body1" sx={{ color: "#1C1917", mb: 2 }}>
            Are you sure you want to remove <strong>{deletingParticipant?.officialName}</strong>?
          </Typography>
          {data?.assignmentsGenerated && (
            <Alert severity="warning">
              Secret Santa assignments have already been generated. Deleting a participant will require regenerating assignments!
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ background: "#FFFFFF", px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete Participant
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lock Confirmation Modal */}
      <Dialog open={confirmLockModalOpen} onClose={() => setConfirmLockModalOpen(false)}>
        <DialogTitle sx={{ background: "#FFFFFF", color: "#78350F", fontWeight: 800 }}>
          Lock Secret Santa Assignments Permanently?
        </DialogTitle>
        <DialogContent sx={{ background: "#FFFFFF", pt: 2 }}>
          <Typography variant="body1" sx={{ color: "#1C1917", mb: 2 }}>
            Once locked, the Secret Santa pairings are final and permanent. No member or administrator can change or reshuffle them.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ background: "#FFFFFF", px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmLockModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleLockAssignments} variant="contained" sx={{ background: "linear-gradient(135deg, #FDE68A, #D4AF37)", color: "#452C06", fontWeight: 800 }}>
            Confirm & Lock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
